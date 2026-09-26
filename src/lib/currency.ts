// The FCFA (XAF) is pegged to the euro at a fixed, official parity, so an
// English-speaking visitor can be shown an *exact-enough* euro equivalent
// without any exchange-rate API. It is only ever an indication next to the
// price in FCFA — the contract, invoices and payments stay in FCFA.
export const XAF_PER_EUR = 655.957

export const fcfaToEur = (fcfa: number) => Math.round(fcfa / XAF_PER_EUR)

const eur = (n: number) => `€${n.toLocaleString('en-GB')}`

// "≈ €534" for 350 000, or "≈ €534 – €915" for a range.
export function eurApprox(min: number, max?: number): string {
  const lo = fcfaToEur(min)
  const hi = max === undefined ? lo : fcfaToEur(max)
  return lo === hi ? `≈ ${eur(lo)}` : `≈ ${eur(lo)} – ${eur(hi)}`
}

// Reads an amount or range written in FCFA ("600 000 – 1 000 000 FCFA",
// "150 000 FCFA", "À partir de 1.200.000 F CFA") and returns its euro
// equivalent, or null when the text holds no such amount ("Sur devis").
const AMOUNT = String.raw`\d[\d\s.,  ]*\d|\d`
const PRICE_RE = new RegExp(String.raw`(${AMOUNT})(?:\s*[–—-]\s*(${AMOUNT}))?\s*F\s?CFA`, 'i')
const digits = (s: string) => Number(s.replace(/\D/g, ''))

export function eurFromLabel(label: string): string | null {
  const m = PRICE_RE.exec(label)
  if (!m) return null
  const min = digits(m[1])
  const max = m[2] ? digits(m[2]) : undefined
  if (!Number.isFinite(min) || min <= 0) return null
  return eurApprox(min, max)
}
