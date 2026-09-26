import { describe, expect, it } from 'vitest'
import { DEFAULT_BUSINESS, computeTotals, frNumber, resolveBusiness, resolveTerms, splitPayment, splitTTC, vatLabel } from '@/lib/business'
import { PERSONAL } from './fixtures'

describe('resolveBusiness', () => {
  it('falls back to the defaults when nothing is set', () => {
    expect(resolveBusiness({ business: undefined })).toEqual(DEFAULT_BUSINESS)
    expect(resolveBusiness(null)).toEqual(DEFAULT_BUSINESS)
  })

  it('clamps out-of-range numbers instead of trusting them', () => {
    const b = resolveBusiness({ business: { depositPercent: 150, vatRate: -5, latePenaltyRate: 1000, deliveryDays: 0, includedRevisions: -3, paymentDueDays: 9999 } })
    expect(b.depositPercent).toBe(100)
    expect(b.vatRate).toBe(0)
    expect(b.latePenaltyRate).toBe(100)
    expect(b.deliveryDays).toBe(1)
    expect(b.includedRevisions).toBe(0)
    expect(b.paymentDueDays).toBe(365)
  })

  it('ignores non-numeric values', () => {
    const b = resolveBusiness({ business: { depositPercent: Number.NaN, deliveryDays: 'abc' as unknown as number } })
    expect(b.depositPercent).toBe(DEFAULT_BUSINESS.depositPercent)
    expect(b.deliveryDays).toBe(DEFAULT_BUSINESS.deliveryDays)
  })

  it('keeps a blank exemption mention on the default text', () => {
    expect(resolveBusiness({ business: { vatExemptionMention: '   ' } }).vatExemptionMention).toBe(DEFAULT_BUSINESS.vatExemptionMention)
  })
})

describe('payment arithmetic', () => {
  it('splits a total into deposit + balance that always add up', () => {
    expect(splitPayment(383500, 30)).toEqual({ acompte: 115050, solde: 268450 })
    for (let total = 1; total < 5000; total += 137) {
      for (const pct of [0, 10, 30, 33, 50, 99, 100]) {
        const { acompte, solde } = splitPayment(total, pct)
        expect(acompte + solde).toBe(total)
        expect(acompte).toBeGreaterThanOrEqual(0)
        expect(solde).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('computes totals with and without VAT', () => {
    expect(computeTotals([{ quantite: 2, prixUnitaireHT: 50000 }], { vatEnabled: true, vatRate: 18 })).toEqual({ totalHT: 100000, tva: 18000, totalTTC: 118000 })
    expect(computeTotals([{ quantite: 2, prixUnitaireHT: 50000 }], { vatEnabled: false, vatRate: 18 })).toEqual({ totalHT: 100000, tva: 0, totalTTC: 100000 })
  })

  it('extracts HT + VAT out of a TTC amount without losing a franc', () => {
    for (const ttc of [1, 97500, 115050, 383500, 999999]) {
      const { ht, tva } = splitTTC(ttc, { vatEnabled: true, vatRate: 18 })
      expect(ht + tva).toBe(ttc)
    }
    expect(splitTTC(5000, { vatEnabled: false, vatRate: 18 })).toEqual({ ht: 5000, tva: 0 })
  })

  it('formats French decimals and the VAT label', () => {
    expect(frNumber(1.5)).toBe('1,5')
    expect(vatLabel({ vatEnabled: true, vatRate: 18 })).toBe('TVA (18 %)')
    expect(vatLabel({ vatEnabled: false, vatRate: 18 })).toBe('TVA')
  })
})

describe('resolveTerms', () => {
  it('uses the terms frozen on the quote, not the current settings', () => {
    const frozen = { ...resolveTerms({}, PERSONAL), depositPercent: 30 }
    const changed = { ...PERSONAL, business: { ...PERSONAL.business, depositPercent: 80 } }
    expect(resolveTerms({ terms: frozen }, changed).depositPercent).toBe(30)
  })

  it('gives a quote without a snapshot the historical defaults, with the current identity', () => {
    const terms = resolveTerms({}, { ...PERSONAL, business: { ...PERSONAL.business, depositPercent: 80, taxId: 'NIF-X' } })
    expect(terms.depositPercent).toBe(DEFAULT_BUSINESS.depositPercent)
    expect(terms.taxId).toBe('NIF-X')
  })
})
