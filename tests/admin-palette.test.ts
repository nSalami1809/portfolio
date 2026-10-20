import { describe, it, expect } from 'vitest'
import { askHref, buildEntries, cleanQuery, escapeRegex, moveIndex, quoteSearchTerm, rankPages, type PalettePage } from '@/lib/admin-palette'

const pages: PalettePage[] = [
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/quotes', label: 'Devis' },
  { href: '/admin/invoices', label: 'Factures' },
  { href: '/admin/chats', label: 'Conversations chat' },
  { href: '/admin/calendar', label: 'Calendrier' },
  { href: '/admin/assistant', label: 'NemCopilotIA' },
  { href: '/admin/settings', label: 'Paramètres du site' },
]

describe('ranking pages', () => {
  it('lists the first pages when nothing is typed', () => {
    expect(rankPages(pages, '', 3).map((p) => p.label)).toEqual(['Tableau de bord', 'Devis', 'Factures'])
  })

  it('finds a page by the start of its label, ignoring case and accents', () => {
    expect(rankPages(pages, 'dev')[0].href).toBe('/admin/quotes')
    expect(rankPages(pages, 'PARAMÈTRES')[0].href).toBe('/admin/settings')
    expect(rankPages(pages, 'parametres')[0].href).toBe('/admin/settings')
  })

  it('finds a page by how the admin thinks of it, not only its label', () => {
    expect(rankPages(pages, 'relance')[0].href).toBe('/admin/quotes')
    expect(rankPages(pages, 'rdv')[0].href).toBe('/admin/calendar')
    expect(rankPages(pages, 'pouce')[0].href).toBe('/admin/chats')
    expect(rankPages(pages, 'copilot')[0].href).toBe('/admin/assistant')
  })

  it('puts a label match before a keyword match, and returns nothing for nonsense', () => {
    const ranked = rankPages(pages, 'chat')
    expect(ranked[0].href).toBe('/admin/chats')
    expect(rankPages(pages, 'zzzzqq')).toEqual([])
  })
})

describe('what the palette shows', () => {
  const quotes = [{ numero: 'DEV-2026-014', clientNom: 'Awa Mbeki', status: 'pending', totalTTC: 1850000 }]

  it('opens on the robot when nothing is typed, then the pages', () => {
    const entries = buildEntries('', pages, [])
    expect(entries[0]).toMatchObject({ kind: 'robot', label: 'Ouvrir NemCopilotIA' })
    expect(entries.slice(1).every((e) => e.kind === 'page')).toBe(true)
  })

  it('keeps asking NemCopilotIA as the first row once a question is typed, with the text prepared in the address', () => {
    const entries = buildEntries('quel devis relancer cette semaine', pages, [])
    expect(entries[0].kind).toBe('ask')
    if (entries[0].kind === 'ask') expect(entries[0].href).toBe(`/admin/assistant?prefill=${encodeURIComponent('quel devis relancer cette semaine')}`)
  })

  it('shows matching quotes between the question and the pages', () => {
    const entries = buildEntries('mbeki', pages, quotes)
    expect(entries.map((e) => e.kind)).toEqual(['ask', 'quote'])
    expect(entries[1]).toMatchObject({ label: 'DEV-2026-014 · Awa Mbeki', hint: expect.stringContaining('En attente') })
    if (entries[1].kind === 'quote') expect(entries[1].href).toBe('/admin/quotes?q=DEV-2026-014')
  })

  it('never offers a robot row for a short query, and caps quotes at five', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ numero: `DEV-2026-0${i}`, clientNom: 'X', status: 'accepted', totalTTC: 1 }))
    expect(buildEntries('de', pages, many).filter((e) => e.kind === 'quote')).toHaveLength(5)
    expect(buildEntries('de', pages, []).some((e) => e.kind === 'ask')).toBe(false)
  })
})

describe('typed text stays plain', () => {
  it('drops control characters, collapses spaces and bounds the length', () => {
    expect(cleanQuery('  devis \u0000\n\tà   relancer  ')).toBe('devis à relancer')
    expect(cleanQuery('x'.repeat(900)).length).toBe(200)
    expect(askHref('a'.repeat(900)).length).toBeLessThan(700)
  })

  it('encodes what goes into an address', () => {
    expect(askHref('relance & suite ?x=1')).toBe(`/admin/assistant?prefill=${encodeURIComponent('relance & suite ?x=1')}`)
    expect(askHref('relance & suite ?x=1')).not.toContain('&suite')
  })
})

describe('quote search term', () => {
  it('needs two characters and is bounded', () => {
    expect(quoteSearchTerm('a')).toBeNull()
    expect(quoteSearchTerm('  ')).toBeNull()
    expect(quoteSearchTerm(42)).toBeNull()
    expect(quoteSearchTerm(undefined)).toBeNull()
    expect(quoteSearchTerm('mb')).toBe('mb')
    expect(quoteSearchTerm('y'.repeat(100))!.length).toBe(40)
  })

  it('is escaped so it can never act as a pattern', () => {
    const term = quoteSearchTerm('.*(a+)+$')!
    const rx = new RegExp(escapeRegex(term), 'i')
    expect(rx.test('.*(a+)+$')).toBe(true)
    expect(rx.test('aaaaaaaa')).toBe(false)
    expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c')
  })
})

describe('keyboard movement', () => {
  it('wraps around both ways and copes with an empty list', () => {
    expect(moveIndex(0, 1, 3)).toBe(1)
    expect(moveIndex(2, 1, 3)).toBe(0)
    expect(moveIndex(0, -1, 3)).toBe(2)
    expect(moveIndex(0, 1, 0)).toBe(0)
  })
})
