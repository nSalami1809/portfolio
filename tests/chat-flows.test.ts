import { describe, it, expect } from 'vitest'
import { QUOTE_EDIT_REQUEST, formatSlotDay, slotMessage, summarizeQuoteDraft, visibleSlotDays } from '@/lib/chat-flows'
import { cleanTitle, getPageHint, pageSuggestions, setPageHint, subscribePageHint } from '@/lib/chat-page-context'

describe('slots as buttons', () => {
  it('keeps at most 5 days and 8 times a day, and drops empty or malformed ones', () => {
    const times = Array.from({ length: 12 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`)
    const days = [
      { date: '2026-10-19', slots: times },
      { date: 'lundi', slots: ['09:00'] },
      { date: '2026-10-20', slots: [] },
      { date: '2026-10-21', slots: ['9h', '10:30'] },
      ...Array.from({ length: 6 }, (_, i) => ({ date: `2026-11-0${i + 1}`, slots: ['09:00'] })),
    ]
    const out = visibleSlotDays(days)
    expect(out).toHaveLength(5)
    expect(out[0].slots).toHaveLength(8)
    expect(out.map((d) => d.date).slice(0, 3)).toEqual(['2026-10-19', '2026-10-21', '2026-11-01'])
    expect(out[1].slots).toEqual(['10:30'])
  })

  it('says the day in the visitor language, whatever the server time zone', () => {
    expect(formatSlotDay('fr', '2026-10-22')).toBe('jeudi 22 octobre')
    expect(formatSlotDay('en', '2026-10-22')).toBe('Thursday 22 October')
  })

  it('sends the exact ISO day and time the assistant needs to book', () => {
    expect(slotMessage('fr', '2026-10-22', '09:00')).toBe('Je souhaite réserver le créneau du jeudi 22 octobre à 09:00 (2026-10-22, heure de Libreville).')
    expect(slotMessage('en', '2026-10-22', '14:30')).toContain('(2026-10-22, Libreville time)')
  })
})

describe('quote summary before it is generated', () => {
  const input = {
    clientNom: ' Awa Mbeki ', clientSociete: 'Studio Mbeki', descriptionProjet: '  Un site\nvitrine  pour mon cabinet ',
    brief: { objectifs: 'Être trouvé sur Google', echeance: ' fin décembre ', contraintes: '   ', publicCible: undefined },
    items: [
      { designation: 'Site vitrine (Standard)', quantite: 1, prixUnitaireHT: 450000 },
      { designation: ' Hébergement ', quantite: 2, prixUnitaireHT: 50000 },
      { designation: '  ', quantite: 1, prixUnitaireHT: 999 },
    ],
  }

  it('lists the client, the project, the brief and each line with computed totals', () => {
    const s = summarizeQuoteDraft(input, 'fr')
    expect(s.client).toBe('Awa Mbeki · Studio Mbeki')
    expect(s.project).toBe('Un site vitrine pour mon cabinet')
    expect(s.brief).toEqual([{ key: 'Objectifs', value: 'Être trouvé sur Google' }, { key: 'Échéance', value: 'fin décembre' }])
    expect(s.lines).toEqual([
      { designation: 'Site vitrine (Standard)', quantity: 1, unit: 450000, total: 450000 },
      { designation: 'Hébergement', quantity: 2, unit: 50000, total: 100000 },
    ])
    expect(s.totalHT).toBe(550000)
  })

  it('uses the English labels, and never invents a value', () => {
    expect(summarizeQuoteDraft(input, 'en').brief[0].key).toBe('Goals')
    const empty = summarizeQuoteDraft({}, 'fr')
    expect(empty).toEqual({ client: '', project: '', brief: [], lines: [], totalHT: 0 })
  })

  it('copes with nonsense numbers', () => {
    const s = summarizeQuoteDraft({ items: [{ designation: 'X', quantite: -3, prixUnitaireHT: Number.NaN }, { designation: 'Y', quantite: 2.6, prixUnitaireHT: 1000 }] }, 'fr')
    expect(s.lines[0]).toMatchObject({ quantity: 1, unit: 0, total: 0 })
    expect(s.lines[1]).toMatchObject({ quantity: 3, total: 3000 })
  })

  it('has a request to change the summary that asks for the new details, not for a quote', () => {
    expect(QUOTE_EDIT_REQUEST).toContain('generateQuote')
    expect(QUOTE_EDIT_REQUEST).toContain("ce qu'il veut changer")
  })
})

describe('suggestions by page', () => {
  it('knows a project page from its registered title, with chips that send a prepared message', () => {
    const s = pageSuggestions('/fr/projects/demo', { kind: 'project', title: 'Projet « Démo »' }, 'fr')!
    expect(s.label).toBe('Projet Démo')
    expect(s.chips[0]).toEqual({ label: 'Parler de ce projet', text: 'Parle-moi du projet « Projet Démo ».' })
  })

  it('ignores a stale title once the visitor has left the project or the article', () => {
    expect(pageSuggestions('/fr/projects', { kind: 'project', title: 'Démo' }, 'fr')).toBeNull()
    expect(pageSuggestions('/fr/blog/un-article', { kind: 'project', title: 'Démo' }, 'fr')).toBeNull()
    expect(pageSuggestions('/fr/blog/un-article', null, 'fr')).toBeNull()
    expect(pageSuggestions('/fr/projects/demo', null, 'fr')).toBeNull()
  })

  it('suggests the pricing panel on the offers page and the tracker on the quote page, in both languages', () => {
    expect(pageSuggestions('/fr/offres', null, 'fr')!.chips[0]).toEqual({ label: 'Voir les tarifs', action: 'services' })
    expect(pageSuggestions('/en/offres', null, 'en')!.chips[0]).toEqual({ label: 'See pricing', action: 'services' })
    expect(pageSuggestions('/fr/devis', null, 'fr')!.chips.some((c) => c.action === 'track')).toBe(true)
    expect(pageSuggestions('/en/calendrier', null, 'en')!.chips[0].text).toContain('book a call')
  })

  it('offers nothing on the other pages, the signing page included', () => {
    for (const p of ['/fr', '/en/vision', '/fr/devis/signature/abc', '/fr/suivi', '/admin/quotes', null]) expect(pageSuggestions(p, null, 'fr'), String(p)).toBeNull()
  })

  it('cleans a title before it travels in a message', () => {
    expect(cleanTitle('  Un « titre »\n"piégé"\t ')).toBe('Un titre piégé')
    expect(cleanTitle('x'.repeat(300)).length).toBe(120)
  })

  it('shares the current title through a store the widget can follow', () => {
    let calls = 0
    const stop = subscribePageHint(() => { calls++ })
    setPageHint({ kind: 'blog', title: 'Mon « article »' })
    expect(getPageHint()).toEqual({ kind: 'blog', title: 'Mon article' })
    setPageHint(null)
    expect(getPageHint()).toBeNull()
    stop()
    setPageHint({ kind: 'blog', title: 'x' })
    expect(calls).toBe(2)
    setPageHint(null)
  })
})
