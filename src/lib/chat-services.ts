// Pure helpers behind the visitor chat's service cards, quote tracking and "talk to
// Nawaf" links. Everything here is computed from the site's real data (offers, the
// quote the visitor looked up) with no model call, so it costs no free-tier request.
import type { Offer } from '@/types'

export type ChatLocale = 'fr' | 'en'

const group = (n: number, sep: string) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep)

// Every card shows the starting price of ITS OWN offer, so a new offer, or a price changed
// in the back-office, shows up with no code change. The price comes from the offer's
// numeric minimum when it has one (excluding tax, like the quote builder), otherwise from
// the first amount written in its price label ("350 000 – 600 000 FCFA" gives 350 000).
// With neither ("Sur devis"), the card says so instead of inventing a number.
const AMOUNT = String.raw`\d[\d\s.,  ]*\d|\d`
const LABEL_PRICE = new RegExp(String.raw`(${AMOUNT})(?:\s*[–—-]\s*(?:${AMOUNT}))?\s*(?:F\s?CFA|XAF)`, 'i')

export interface BasePrice {
  amount: number
  /** Known to be excluding tax (it comes from the offer's numeric range). */
  ht: boolean
}

export function basePrice(offer: Pick<Offer, 'priceHTMin' | 'priceLabel'>): BasePrice | null {
  if (typeof offer.priceHTMin === 'number' && Number.isFinite(offer.priceHTMin) && offer.priceHTMin > 0) return { amount: offer.priceHTMin, ht: true }
  const m = LABEL_PRICE.exec(offer.priceLabel ?? '')
  if (!m) return null
  const amount = Number(m[1].replace(/\D/g, ''))
  return Number.isFinite(amount) && amount > 0 ? { amount, ht: false } : null
}

export function fromPriceLabel(locale: ChatLocale, price: BasePrice | null): string {
  if (!price) return locale === 'en' ? 'On quote' : 'Sur devis'
  const amount = group(price.amount, locale === 'en' ? ',' : ' ')
  return locale === 'en' ? `From ${amount} FCFA${price.ht ? ' excl. tax' : ''}` : `À partir de ${amount} FCFA${price.ht ? ' HT' : ''}`
}

export const PRICE_DISCLAIMER: Record<ChatLocale, string> = {
  fr: 'Prix indicatif : le devis fait foi.',
  en: 'Indicative price: the quote is what counts.',
}

export interface ServiceCard {
  id: string
  title: string
  summary: string
  features: string[]
  /** Starting price of this offer, or null when it is on quote. */
  price: BasePrice | null
  /** The offer's own price line from the site (the full range), when it has one worth showing. */
  priceDetail: string | null
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

export function serviceCards(offers: Offer[], max = 6): ServiceCard[] {
  return offers
    .filter((o) => o.title?.trim())
    .slice(0, max)
    .map((o) => {
      const label = (o.priceLabel ?? '').trim()
      return {
        id: o.id,
        title: o.title.trim(),
        summary: clip((o.description ?? '').replace(/\s+/g, ' ').trim(), 110),
        features: (o.features ?? []).filter(Boolean).slice(0, 3),
        price: basePrice(o),
        priceDetail: label && !/^sur devis$/i.test(label) ? label : null,
      }
    })
}

export function quoteRequestMessage(locale: ChatLocale, title: string): string {
  return locale === 'en' ? `I'd like a quote for: ${title}.` : `Je souhaite un devis pour : ${title}.`
}

// ── Tracking a quote ───────────────────────────────────────────────────────────────────

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/

/** The 6-character access code from what the visitor typed, or null. */
export function normalizeAccessCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase()
  return CODE_RE.test(code) ? code : null
}

export const trackingHref = (locale: ChatLocale, code: string) => `/${locale}/suivi?ref=${encodeURIComponent(code)}`

export function trackingMessage(locale: ChatLocale, code: string): string {
  return locale === 'en' ? `My quote access code is ${code}. Where does my quote stand?` : `Mon code d'accès est ${code}. Où en est mon devis ?`
}

export interface QuoteLike {
  status?: 'pending' | 'accepted' | 'declined'
  signature?: unknown
  delivery?: unknown
  acceptance?: unknown
}
export interface ProgressStep { key: 'issued' | 'signed' | 'delivered' | 'accepted'; label: string; done: boolean }

const STEP_LABELS: Record<ChatLocale, Record<ProgressStep['key'], string>> = {
  fr: { issued: 'Devis émis', signed: 'Signé', delivered: 'Livré', accepted: 'Recette signée' },
  en: { issued: 'Quote issued', signed: 'Signed', delivered: 'Delivered', accepted: 'Acceptance signed' },
}

/** Where a quote stands, from the facts on the quote itself. */
export function quoteProgress(q: QuoteLike, locale: ChatLocale): { steps: ProgressStep[]; declined: boolean; current: number } {
  const declined = q.status === 'declined'
  const done: Record<ProgressStep['key'], boolean> = {
    issued: true,
    signed: Boolean(q.signature) || q.status === 'accepted',
    delivered: Boolean(q.delivery),
    accepted: Boolean(q.acceptance),
  }
  const steps = (['issued', 'signed', 'delivered', 'accepted'] as const).map((key) => ({ key, label: STEP_LABELS[locale][key], done: done[key] }))
  return { steps, declined, current: steps.filter((s) => s.done).length }
}

// ── Talking to the owner ────────────────────────────────────────────────────────────────

export const contactHref = (locale: ChatLocale, message?: string) =>
  `/${locale}/contact${message?.trim() ? `?message=${encodeURIComponent(message.trim().slice(0, 500))}` : ''}`

export const bookingHref = (locale: ChatLocale) => `/${locale}/calendrier`

/** The visitor's latest question, to prefill the contact form. */
export function lastVisitorText(messages: { role: string; parts: { type: string; text?: string }[] }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const text = m.parts.map((p) => (p.type === 'text' ? p.text ?? '' : '')).join(' ').replace(/\s+/g, ' ').trim()
    if (text) return text
  }
  return ''
}

export const TEASER_TEXT: Record<ChatLocale, { text: string; close: string }> = {
  fr: { text: 'Une question, un tarif, un devis ? NemCopilotIA répond tout de suite.', close: "Fermer l'invitation" },
  en: { text: 'A question, a price, a quote? NemCopilotIA answers right away.', close: 'Dismiss the invitation' },
}

/** Pages where an unprompted invitation would get in the way (signing, delivery acceptance). */
export function teaserAllowed(pathname: string | null | undefined): boolean {
  if (!pathname || pathname.startsWith('/admin')) return false
  return !/\/(devis\/signature|recette|suivi)(\/|$)/.test(pathname)
}
