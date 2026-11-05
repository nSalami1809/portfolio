import type { Offer } from '@/types'
import { basePrice } from '@/lib/chat-services'

/**
 * The offers shown in the hero's example quote: taken from the site's own offers, with their own starting prices (the
 * numeric minimum when the offer has one, otherwise the first amount written in its price label: the same rule as the chat's
 * service cards). Nothing is written by hand: change a price in the admin and the example follows.
 * The featured offers come first, then the order of the list; an offer on quote ("Sur devis") has no price to show and is left out.
 */
export function quotePreviewOffers(offers: Offer[], max = 3): Offer[] {
  const priced = offers.filter((o) => o.title?.trim() && basePrice(o) !== null)
  return [...priced.filter((o) => o.featured), ...priced.filter((o) => !o.featured)].slice(0, max)
}

export interface PreviewLine {
  id: string
  title: string
  amount: number
}

export function previewLines(offers: Offer[], titles: Record<string, string>): PreviewLine[] {
  return offers.map((o) => ({ id: o.id, title: (titles[o.id] ?? o.title).trim(), amount: basePrice(o)!.amount }))
}

export const previewTotal = (lines: PreviewLine[]) => lines.reduce((sum, l) => sum + l.amount, 0)

/** 80000 → "80 000 FCFA" (French, non-breaking spaces) or "80,000 FCFA" (English) */
export function formatFcfa(amount: number, locale: 'fr' | 'en'): string {
  return `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'en' ? ',' : '\u00a0')}\u00a0FCFA`
}
