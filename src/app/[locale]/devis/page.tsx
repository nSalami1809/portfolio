import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { fetchPortfolioSafe } from '@/lib/portfolio-data'
import { whatsappLink } from '@/lib/whatsapp'
import { defaultOffers } from '@/data/defaultData'
import DevisView from './DevisView'
import { pageMeta } from '@/lib/seo'

// Same cadence as the other public pages; invalidated on admin publish.
export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  return pageMeta({ locale, path: '/devis', title: t.devis.title, description: t.devis.subtitle })
}

export default async function DevisPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const portfolio = await fetchPortfolioSafe('devis/page')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'
  const contact = {
    href: whatsappLink(portfolio?.personal?.whatsapp, { kind: 'quote' }, locale, portfolio?.personal?.name, `${siteUrl}/${locale}/devis`),
    hint: t.whatsapp.quoteHint,
    cta: t.whatsapp.quoteCta,
  }
  return <DevisView t={t.devis} offers={portfolio?.offers ?? defaultOffers} contact={contact} />
}
