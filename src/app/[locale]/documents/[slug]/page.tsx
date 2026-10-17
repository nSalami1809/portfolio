import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/lib/portfolio-data'
import { defaultDocuments } from '@/data/defaultData'
import { translateFields } from '@/lib/translate'
import { jsonLdScript } from '@/lib/json-ld'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import DocumentDetailView from './DocumentDetailView'
import NotFoundMessage from '@/components/NotFoundMessage'
import { LOCALES } from '@/lib/i18n/locale'
import { pageMeta } from '@/lib/seo'

// Regenerate at most once every 30s, matching every sibling route;
// invalidated instantly on admin publish via updateTag('portfolio').
export const revalidate = 30

export async function generateStaticParams() {
  const portfolio = await fetchPortfolioSafe('documents/[slug]/generateStaticParams')
  const documents = portfolio?.documents ?? defaultDocuments
  return LOCALES.flatMap((locale) => documents.map((d) => ({ locale, slug: d.slug })))
}

async function getDocument(slug: string) {
  const portfolio = await fetchPortfolioSafe('documents/[slug]/page')
  const documents = portfolio?.documents ?? defaultDocuments
  return documents.find((d) => d.slug === slug) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const document = await getDocument(slug)
  if (!document) return { robots: { index: false, follow: false } }

  const translated = await translateFields(`document:${slug}`, locale, {
    title: document.title,
    description: document.description,
  })

  return pageMeta({
    locale,
    path: `/documents/${slug}`,
    title: translated.title,
    description: translated.description,
    type: 'article',
  })
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const document = await getDocument(slug)

  if (!document) {
    return <NotFoundMessage locale={locale} t={t.notFound} />
  }

  const translated = await translateFields(`document:${slug}`, locale, {
    title: document.title,
    description: document.description,
  })

  // Starts the DNS/TLS handshake to the Blob storage origin as soon as this
  // page's HTML arrives, instead of only once the client-side preview
  // component mounts and fires its first fetch — shaves that round trip off
  // the time-to-first-render of the in-page preview.
  const blobOrigin = (() => {
    try { return new URL(document.fileUrl).origin } catch { return null }
  })()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: translated.title,
    description: translated.description,
    datePublished: document.date,
    author: { '@type': 'Person', name: 'Nawaf Nemrod Salami' },
    encodingFormat: document.fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    url: `${siteUrl}/${locale}/documents/${slug}`,
    mainEntityOfPage: `${siteUrl}/${locale}/documents/${slug}`,
  }

  return (
    <>
      {blobOrigin && <link rel="preconnect" href={blobOrigin} crossOrigin="anonymous" />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <DocumentDetailView
        document={{ ...document, ...translated }}
        locale={locale}
        t={t.documents}
      />
    </>
  )
}
