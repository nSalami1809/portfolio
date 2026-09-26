import { describe, expect, it } from 'vitest'
import { eurApprox, eurFromLabel, fcfaToEur } from '@/lib/currency'

describe('currency', () => {
  it('converts at the fixed CFA/euro parity', () => {
    expect(fcfaToEur(655_957)).toBe(1000)
    expect(fcfaToEur(0)).toBe(0)
  })

  it('formats a single amount and a range', () => {
    expect(eurApprox(655_957)).toBe('≈ €1,000')
    expect(eurApprox(350_000, 600_000)).toBe('≈ €534 – €915')
  })

  it('reads the offers price labels', () => {
    expect(eurFromLabel('600 000 – 1 000 000 FCFA')).toBe('≈ €915 – €1,524')
    expect(eurFromLabel('150 000 FCFA')).toBe('≈ €229')
    expect(eurFromLabel('À partir de 1.200.000 F CFA')).toBe('≈ €1,829')
    expect(eurFromLabel('350 000 – 600 000 FCFA')).toBe('≈ €534 – €915')
  })

  it('leaves non-numeric labels alone', () => {
    expect(eurFromLabel('Sur devis')).toBeNull()
    expect(eurFromLabel('')).toBeNull()
  })
})
