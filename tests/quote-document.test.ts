import { describe, expect, it } from 'vitest'
import {
  CURRENT_DOC_VERSION, addBusinessDays, buildAcceptanceBlocks, buildAvenantBlocks, buildContractBlocks, buildDevisBlocks,
  documentKind, paymentBlock, parseLocation, type DocBlock,
} from '@/lib/quote-document'
import { resolveBusiness, snapshotTerms } from '@/lib/business'
import { safeText } from '@/lib/pdf-kit'
import { ITEMS, PERSONAL, SITE, makeQuote, withBusiness } from './fixtures'

const delivered = { deliveredAt: '2026-02-10T09:00:00.000Z', note: 'Livré.', liveUrl: 'https://client.example' }
const allTexts = (blocks: DocBlock[]) => blocks.flatMap((b) => [b.title, ...(b.paragraphs ?? []), ...(b.bullets ?? [])])

const signed = makeQuote({ status: 'accepted', delivery: delivered })
const avenant = makeQuote({ kind: 'avenant', numero: 'AVN-2026-001', parentNumero: 'DEV-2026-001', extraDelayDays: 5, status: 'accepted' })

describe('golden wording (released version 1)', () => {
  // These pin exactly what every released wording version prints. If one of
  // them fails, a clause was edited in place: add a new wording version
  // instead (see CURRENT_DOC_VERSION in lib/quote-document.ts) — never update
  // a snapshot of a version that signed documents may already rely on.
  it('devis', () => expect(buildDevisBlocks(makeQuote(), PERSONAL, SITE)).toMatchSnapshot())
  it('contrat', () => expect(buildContractBlocks(signed, PERSONAL, SITE)).toMatchSnapshot())
  it('avenant', () => expect(buildAvenantBlocks(avenant, PERSONAL)).toMatchSnapshot())
  it('procès-verbal de recette', () => expect(buildAcceptanceBlocks(signed, PERSONAL)).toMatchSnapshot())
  it('procès-verbal signé avec réserves', () => {
    const q = makeQuote({ status: 'accepted', delivery: delivered, acceptance: { name: 'C', email: 'c@e.com', imageUrl: '', signedAt: '2026-02-11T09:00:00.000Z', documentHash: 'h', reserves: 'La page contact.' } })
    expect(buildAcceptanceBlocks(q, PERSONAL)).toMatchSnapshot()
  })
})

describe('wording versions', () => {
  it('a quote keeps the version it was issued under; unknown versions fall back to the current one', () => {
    expect(CURRENT_DOC_VERSION).toBe(1)
    const v1 = buildDevisBlocks(makeQuote({ docVersion: 1 }), PERSONAL, SITE)
    expect(buildDevisBlocks(makeQuote({ docVersion: undefined }), PERSONAL, SITE)).toEqual(v1)
    expect(buildDevisBlocks(makeQuote({ docVersion: 99 }), PERSONAL, SITE)).toEqual(v1)
  })
})

describe('what the documents say comes from the quote terms', () => {
  it('prints the frozen figures, not the current settings', () => {
    const quote = makeQuote() // frozen with 30 % / 30 days / 2 revisions
    const changed = withBusiness({ depositPercent: 80, deliveryDays: 90, includedRevisions: 9 })
    const text = allTexts(buildContractBlocks(quote, changed, SITE)).join('\n')
    expect(text).toContain('Acompte de 30 %')
    expect(text).toContain('30 jours ouvrés')
    expect(text).toContain('2 cycles de révision')
    expect(text).not.toContain('80 %')
    expect(text).not.toContain('90 jours')
  })

  it('never prints the payment coordinates on a devis or a contract', () => {
    const text = [...allTexts(buildDevisBlocks(makeQuote(), PERSONAL, SITE)), ...allTexts(buildContractBlocks(signed, PERSONAL, SITE))].join('\n')
    expect(text).not.toContain('SECRET-PAYMENT-COORDINATES')
  })

  it('states the deposit is due on receipt and the balance after the delay', () => {
    const text = allTexts(buildDevisBlocks(makeQuote(), PERSONAL, SITE)).join('\n')
    expect(text).toContain("La facture d'acompte est payable dès sa réception")
    expect(text).toContain('la facture de solde est payable sous 7 jours')
  })

  it('drops the deposit wording when there is none', () => {
    for (const depositPercent of [0, 100]) {
      const quote = makeQuote({}, { ...PERSONAL.business, depositPercent })
      const text = allTexts(buildDevisBlocks(quote, PERSONAL, SITE)).join('\n')
      expect(text).toContain('Paiement intégral à la livraison finale')
      expect(text).not.toMatch(/Acompte de \d+ %/)
    }
  })

  it('handles a VAT-exempt provider', () => {
    const quote = makeQuote({}, { ...PERSONAL.business, vatEnabled: false })
    const text = allTexts(buildContractBlocks({ ...quote, status: 'accepted' }, PERSONAL, SITE)).join('\n')
    expect(text).toContain('TVA non applicable')
    expect(text).not.toContain('TVA 18 %')
  })
})

describe('payment block', () => {
  it('lists a deposit and a balance that add up to the total', () => {
    const quote = makeQuote()
    const { bullets } = paymentBlock(quote, snapshotTerms(PERSONAL))
    // "Acompte de 30 % à la signature : 115 050 FCFA" → the amount after the colon
    const parsed = (bullets ?? []).slice(0, 2).map((b) => Number(b.split(':')[1].replace(/\D/g, '')))
    expect(parsed[0] + parsed[1]).toBe(quote.totalTTC)
    expect(parsed).toHaveLength(2)
  })
})

describe('every clause can be drawn by the PDF fonts', () => {
  it('contains only WinAnsi-encodable characters', () => {
    const all = [
      ...buildDevisBlocks(makeQuote(), PERSONAL, SITE), ...buildContractBlocks(signed, PERSONAL, SITE),
      ...buildAvenantBlocks(avenant, PERSONAL), ...buildAcceptanceBlocks(signed, PERSONAL),
    ]
    for (const text of allTexts(all)) {
      expect(safeText(text), text.slice(0, 60)).toBe(text.replace(/[  ]/g, ' '))
    }
  })
})

describe('helpers', () => {
  it('parseLocation keeps the city and country and drops the marketing suffix', () => {
    expect(parseLocation('Libreville, Gabon — Disponible en remote')).toEqual({ ville: 'Libreville', pays: 'Gabon' })
    expect(parseLocation('Port-Gentil')).toEqual({ ville: 'Port-Gentil', pays: 'Gabon' })
    expect(parseLocation('')).toEqual({ ville: 'Libreville', pays: 'Gabon' })
  })

  it('addBusinessDays skips weekends', () => {
    // Friday 2026-02-06 + 1 working day = Monday 2026-02-09
    expect(addBusinessDays('2026-02-06T10:00:00.000Z', 1).toISOString().slice(0, 10)).toBe('2026-02-09')
    expect(addBusinessDays('2026-02-06T10:00:00.000Z', 5).toISOString().slice(0, 10)).toBe('2026-02-13')
  })

  it('documentKind distinguishes devis, contrat and avenant', () => {
    expect(documentKind({ kind: 'devis' }, 'devis')).toBe('devis')
    expect(documentKind({ kind: 'devis' }, 'contrat')).toBe('contrat')
    expect(documentKind({ kind: 'avenant' }, 'devis')).toBe('avenant-proposition')
    expect(documentKind({ kind: 'avenant' }, 'contrat')).toBe('avenant')
  })

  it('the fixtures use a real, valid business config', () => {
    expect(resolveBusiness(PERSONAL).depositPercent).toBe(30)
    expect(ITEMS.length).toBe(2)
  })
})
