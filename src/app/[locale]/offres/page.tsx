import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultOffers } from '@/data/defaultData'
import { jsonLdScript } from '@/lib/json-ld'
import { translateFieldsBatch } from '@/lib/translate'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import OffersView, { type TranslatedOffers } from './OffersView'

// Regenerate at most once every 30s; invalidated instantly on admin publish via revalidatePath
export const revalidate = 30

export default async function OffersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE

  const portfolio = await fetchPortfolioSafe('offres/page')
  const offers = portfolio?.offers ?? defaultOffers
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

  // Translated here rather than in the view. OffersView used to fire one
  // Server Action POST per offer from a client effect on every English page
  // view — eight concurrent round trips, each a full server render plus a
  // Mongo read, with the card text visibly swapping underneath the visitor
  // when they landed. One batched server-side call, rendered into the HTML.
  const fields = await translateFieldsBatch(
    locale,
    offers.map((o) => ({
      key: `offer:${o.id}`,
      fields: {
        title: o.title,
        description: o.description,
        features: (o.features ?? []).join('\n'),
      },
    })),
  )
  const translated: TranslatedOffers = Object.fromEntries(
    offers.map((o, i) => [o.id, fields[i]]),
  )

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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      )}
      <OffersView offers={offers} translated={translated} />
    </>
  )
}
