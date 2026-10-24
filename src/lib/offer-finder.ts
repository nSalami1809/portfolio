// "Trouver mon offre": three questions, one advice. Pure rules over the site's REAL offers (they
// are edited in the back-office, so nothing about an offer is written here): what the visitor
// wants is matched against the words of each offer, their budget against its price range. No
// model call, so no free-tier request, and the same answers always give the same advice.
import type { Offer } from '@/types'

export type Goal = 'site' | 'shop' | 'app' | 'api' | 'other'
export type Budget = 'lt400' | 'mid' | 'high' | 'xl' | 'unknown'
export type Delay = 'urgent' | 'normal' | 'relaxed'

export interface Answers {
  goal: Goal
  budget: Budget
  delay: Delay
}

export const GOALS: Goal[] = ['site', 'shop', 'app', 'api', 'other']
export const BUDGETS: Budget[] = ['lt400', 'mid', 'high', 'xl', 'unknown']
export const DELAYS: Delay[] = ['urgent', 'normal', 'relaxed']

/** FCFA, excluding tax like the offers' ranges. `null`: the visitor does not know yet. */
export const BUDGET_RANGE: Record<Budget, [number, number] | null> = {
  lt400: [0, 400_000],
  mid: [400_000, 1_000_000],
  high: [1_000_000, 3_000_000],
  xl: [3_000_000, Infinity],
  unknown: null,
}

// The words that say an offer is about a goal (title and description, French and English).
const TOPIC: Record<Goal, RegExp> = {
  site: /vitrine|landing|portfolio|showcase|pr[ée]senter une activit|present(?:ing)? a business|multi-?pages?/i,
  shop: /boutique|e-?commerce|catalogue|catalog|panier|\bcart\b|online shop|\bstore\b/i,
  app: /application web|web app|tableau de bord|dashboard|multi-?utilisateurs|multi-?user|logique m[ée]tier|business logic/i,
  api: /\bapi\b|backend|int[ée]gration|integration|mobile money|paiement|payment|brancher|plug into/i,
  other: /maintenance|formation|training|prise en main|h[ée]bergement|hosting|ci-?\/?cd|multilingue|multilingual|authentification|authentication|support|d[ée]ploiement|deployment/i,
}

const AMOUNT = /\d[\d\s.,  ]*\d|\d/g

/** The offer's price range, from its numeric range or the amounts written in its label; null when it has none ("Sur devis"). */
export function offerPriceRange(offer: Pick<Offer, 'priceHTMin' | 'priceHTMax' | 'priceLabel'>): [number, number] | null {
  const min = offer.priceHTMin
  const max = offer.priceHTMax
  if (typeof min === 'number' && typeof max === 'number' && min > 0 && max >= min) return [min, max]
  const amounts = (offer.priceLabel ?? '').match(AMOUNT)?.map((a) => Number(a.replace(/\D/g, ''))).filter((n) => Number.isFinite(n) && n > 0) ?? []
  if (amounts.length === 0) return null
  return [Math.min(...amounts), Math.max(...amounts)]
}

export type BudgetFit = 'fits' | 'above' | 'below' | 'unknown'

export interface Match {
  offer: Offer
  score: number
  /** The offer's own words speak about what the visitor wants. */
  topic: boolean
  budget: BudgetFit
}

function budgetFit(offer: Offer, budget: Budget): BudgetFit {
  const wanted = BUDGET_RANGE[budget]
  const range = offerPriceRange(offer)
  if (!wanted || !range) return 'unknown'
  const [lo, hi] = wanted
  if (range[0] > hi) return 'above'
  if (range[1] < lo) return 'below'
  return 'fits'
}

export function scoreOffer(offer: Offer, answers: Answers): Match {
  const text = `${offer.title} ${offer.description}`
  const topic = TOPIC[answers.goal].test(text)
  // the offer's NAME says it: that is a stronger sign than a word in its description
  const inTitle = TOPIC[answers.goal].test(offer.title)
  const budget = budgetFit(offer, answers.budget)
  let score = 0
  if (topic) score += 10
  if (inTitle) score += 6
  // a showcase site is not a shop: keep a shop offer away from the visitor who wants a plain site
  if (answers.goal === 'site' && TOPIC.shop.test(text)) score -= 6
  if (budget === 'fits') score += 6
  else if (budget === 'below') score += 2
  else if (budget === 'above') score -= 8
  // in a hurry: the simpler, cheaper offers are the ones that can be ready soon
  const range = offerPriceRange(offer)
  if (answers.delay === 'urgent' && range && range[1] <= 1_500_000) score += 2
  if (offer.featured) score += 1
  return { offer, score, topic, budget }
}

/**
 * The best offer for these answers and up to two other ideas. An offer is only advised when it
 * has something to do with the visitor's goal; when none has, `best` is null and the page says
 * so honestly instead of pushing something unrelated.
 */
export function recommendOffers(answers: Answers, offers: Offer[]): { best: Match | null; alternatives: Match[] } {
  const ranked = offers
    .map((offer, order) => ({ ...scoreOffer(offer, answers), order }))
    .filter((m) => m.topic)
    .sort((a, b) => b.score - a.score || a.order - b.order)
  const [best, ...rest] = ranked
  return { best: best ?? null, alternatives: rest.slice(0, 2) }
}

/** The answers in one line, for a message to the owner. */
export function describeAnswers(answers: Answers, labels: { goal: Record<Goal, string>; budget: Record<Budget, string>; delay: Record<Delay, string> }): string {
  return [labels.goal[answers.goal], labels.budget[answers.budget], labels.delay[answers.delay]].join(' · ')
}
