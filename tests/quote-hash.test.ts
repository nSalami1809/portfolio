import { describe, expect, it } from 'vitest'
import { computeAcceptanceHash, computeDocumentHash, isExpired } from '@/lib/quote-hash'
import type { QuoteRecord } from '@/lib/quotes-core'

const base = {
  numero: 'DEV-2026-001',
  clientNom: 'Client Test', clientSociete: 'Société Test', clientAdresse: 'Port-Gentil', clientEmail: 'c@example.com', clientTelephone: '1',
  descriptionProjet: 'Un site.',
  items: [{ designation: 'Site', quantite: 1, prixUnitaireHT: 100000 }],
  totalHT: 100000, tva: 18000, totalTTC: 118000,
  dateEmission: new Date('2026-01-15T10:00:00.000Z'), validiteJours: 30,
} as unknown as QuoteRecord

describe('computeDocumentHash', () => {
  it('is deterministic', () => {
    expect(computeDocumentHash(base)).toBe(computeDocumentHash({ ...base }))
  })

  it('never changes for a quote that predates brief / terms / docVersion (pinned)', () => {
    // If this fails, the canonical form changed and every already-signed
    // quote's stored hash would no longer verify. Do not "fix" the expectation.
    expect(computeDocumentHash(base)).toMatchInlineSnapshot(`"8745a8f786412214fd925a30c91ee155c7855765a6963ff73bcc180cffe810bb"`)
  })

  it('changes when anything the client agreed to changes', () => {
    const ref = computeDocumentHash(base)
    expect(computeDocumentHash({ ...base, totalTTC: 118001 })).not.toBe(ref)
    expect(computeDocumentHash({ ...base, items: [{ designation: 'Site', quantite: 2, prixUnitaireHT: 100000 }] })).not.toBe(ref)
    expect(computeDocumentHash({ ...base, descriptionProjet: 'Un autre site.' })).not.toBe(ref)
    expect(computeDocumentHash({ ...base, brief: { objectifs: 'x' } })).not.toBe(ref)
    expect(computeDocumentHash({ ...base, docVersion: 2 })).not.toBe(ref)
    expect(computeDocumentHash({ ...base, extraDelayDays: 5 })).not.toBe(ref)
  })
})

describe('computeAcceptanceHash', () => {
  const doc = { ...base, signature: { documentHash: 'abc' }, delivery: { deliveredAt: new Date('2026-02-01T00:00:00.000Z'), token: 't' } } as unknown as QuoteRecord
  const at = new Date('2026-02-02T00:00:00.000Z')

  it('depends on the reserves and the moment of acceptance', () => {
    const clean = computeAcceptanceHash(doc, '', at)
    expect(computeAcceptanceHash(doc, '', at)).toBe(clean)
    expect(computeAcceptanceHash(doc, 'la page contact', at)).not.toBe(clean)
    expect(computeAcceptanceHash(doc, '', new Date('2026-02-03T00:00:00.000Z'))).not.toBe(clean)
  })
})

describe('isExpired', () => {
  it('flags a quote past its validity', () => {
    expect(isExpired({ dateEmission: new Date(Date.now() - 31 * 86_400_000), validiteJours: 30 })).toBe(true)
    expect(isExpired({ dateEmission: new Date(), validiteJours: 30 })).toBe(false)
  })
})
