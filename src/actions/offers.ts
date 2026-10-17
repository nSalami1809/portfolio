'use server'

import { fetchPortfolioSafe } from '@/lib/portfolio-data'
import type { Offer } from '@/types'

// The offers the visitor chat shows as service cards. Public by design (the /offres
// page prints the same data) and limited to the fields a visitor sees there: nothing
// else of the portfolio leaves through this action. Read on demand, when the visitor
// opens the pricing panel, so the offers are not written into every page's HTML.
export async function getPublicOffers(): Promise<Offer[]> {
  const data = await fetchPortfolioSafe('getPublicOffers')
  return (data?.offers ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    priceLabel: o.priceLabel,
    features: o.features,
    featured: o.featured,
  }))
}
