import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultDocuments } from '@/data/defaultData'
import { translateFields } from '@/lib/translate'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { ogCard, OG_SIZE } from '@/lib/og-card'

export const alt = 'Document — Nawaf Nemrod Salami'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 3600

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const portfolio = await fetchPortfolioSafe('documents/og')
  const document = (portfolio?.documents ?? defaultDocuments).find((d) => d.slug === slug)

  if (!document) return ogCard({ kicker: locale === 'en' ? 'Document' : 'Document', title: 'Nawaf Nemrod Salami' })

  // Same fields as the page itself, so the cached translation is reused.
  const t = await translateFields(`document:${slug}`, locale, {
    title: document.title,
    description: document.description,
  })
  return ogCard({
    kicker: `${locale === 'en' ? 'Document' : 'Document'} · ${document.category}`,
    title: t.title,
    subtitle: t.description,
    tags: [document.fileType.toUpperCase()],
  })
}
