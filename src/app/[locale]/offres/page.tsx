import { fetchPortfolio } from '@/actions/portfolio'
import { defaultOffers } from '@/data/defaultData'
import OffersView from './OffersView'

// Regenerate at most once every 30s; invalidated instantly on admin publish via revalidatePath
export const revalidate = 30

export default async function OffersPage() {
  const portfolio = await fetchPortfolio().catch(() => null)
  const offers = portfolio?.offers ?? defaultOffers
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    name: 'Offres de services',
    itemListElement: offers.map((o) => ({
      '@type': 'Offer',
      name: o.title,
      description: o.description,
      url: `${siteUrl}/fr/offres`,
      priceCurrency: 'XAF',
    })),
  }

  return (
    <>
      {offers.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <OffersView />
    </>
  )
}
