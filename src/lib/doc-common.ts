// Language-neutral pieces of the business documents (devis, contrat, avenant,
// procès-verbal, invoices): the block shape, money and date formatting per
// language, working-day arithmetic. Kept apart from the wording itself
// (quote-document.ts in French, quote-document-en.ts in English) so both can
// import it without importing each other.
import type { Quote } from '@/actions/quotes'

export type DocLang = 'fr' | 'en'

// A document is written in the language the client used on the site when the
// quote was issued (quote.locale); French when unknown.
export const docLang = (q?: { locale?: string } | null): DocLang => (q?.locale === 'en' ? 'en' : 'fr')

export interface DocBlock {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

// toLocaleString groups thousands with a narrow no-break space (U+202F) in
// French. It renders fine on screen, but pdf-lib's WinAnsi-encoded standard
// fonts (used to print this same amount into the emailed PDF) cannot draw that
// exact character — normalize to a plain space so the string is safe in both
// contexts. English groups with commas, which are safe as they are.
export const fmt = (n: number, lang: DocLang = 'fr') =>
  `${lang === 'en' ? n.toLocaleString('en-GB') : n.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} FCFA`

const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
export const formatLongDate = (d: Date | string, lang: DocLang = 'fr') =>
  new Date(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', DATE_FORMAT)

export function computeQuoteDates(quote: Quote) {
  const lang = docLang(quote)
  const dateEmissionDate = new Date(quote.dateEmission)
  const dateEmission = formatLongDate(dateEmissionDate, lang)
  const expiryDate = new Date(dateEmissionDate)
  expiryDate.setDate(expiryDate.getDate() + quote.validiteJours)
  const expiryStr = formatLongDate(expiryDate, lang)
  return { dateEmissionDate, dateEmission, expiryDate, expiryStr }
}

// Working days (Mon–Fri) — public holidays are deliberately not modelled: the
// documents say "working days" and this only produces an indicative date.
export function addBusinessDays(from: Date | string, days: number): Date {
  const d = new Date(from)
  let left = days
  while (left > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return d
}

// "Libreville, Gabon — Disponible en remote" is what the location field
// typically holds: the marketing suffix must never leak into a contract's
// "Fait à …" line or its governing-law clause.
export function parseLocation(location: string): { ville: string; pays: string } {
  const place = (location || '').split(/\s[—–-]\s/)[0].trim() || 'Libreville, Gabon'
  const parts = place.split(',').map((s) => s.trim()).filter(Boolean)
  return { ville: parts[0] || 'Libreville', pays: parts.length > 1 ? parts[parts.length - 1] : 'Gabon' }
}

export const RECETTE_DAYS = 7
export const FORMAL_NOTICE_DAYS = 15

export function numbered(blocks: DocBlock[], start: number, style: 'section' | 'article'): DocBlock[] {
  return blocks.map((b, i) => ({
    ...b,
    title: style === 'article' ? `ARTICLE ${start + i} — ${b.title}` : `${start + i}. ${b.title}`,
  }))
}

// ── Provider-written text, shown in English ─────────────────────────────────
// A few settings are typed by the provider in French ("Virement bancaire",
// "TVA non applicable", "Développeur …"). In an English document the common
// wordings are translated; anything else is printed as typed.
const PAYMENT_METHODS_EN: [RegExp, string][] = [
  [/\bvirements? bancaires?\b/gi, 'Bank transfer'],
  [/\bcarte bancaire\b/gi, 'Bank card'],
  [/\besp[èe]ces\b/gi, 'Cash'],
  [/\bch[èe]ques?\b/gi, 'Cheque'],
  [/\bpaiement en ligne\b/gi, 'Online payment'],
]

export function paymentMethodsFor(text: string, lang: DocLang): string {
  return lang === 'en' ? PAYMENT_METHODS_EN.reduce((s, [re, en]) => s.replace(re, en), text) : text
}

export function vatExemptionFor(text: string, lang: DocLang): string {
  return lang === 'en' && /^TVA non applicable\.?$/i.test(text.trim()) ? 'VAT not applicable' : text
}

export function roleFor(role: string, lang: DocLang): string {
  if (lang !== 'en') return role
  const m = /^D[ée]veloppeur(?:se)?\s+(.+)$/i.exec(role.trim())
  if (m) return `${m[1]} developer`
  return /^D[ée]veloppeur(?:se)?$/i.test(role.trim()) ? 'Developer' : role
}
