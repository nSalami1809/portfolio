import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { translateFieldsBatch } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { defaultDocuments } from '@/data/defaultData'
import DocumentsView from './DocumentsView'
import { pageMeta } from '@/lib/seo'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  return pageMeta({ locale, path: '/documents', title: t.documents.title, description: t.documents.subtitle })
}

export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolioSafe('documents/page')
  const documents = portfolio?.documents ?? defaultDocuments

  // One cache round trip for the whole list, not one per document.
  const fields = await translateFieldsBatch(
    locale,
    documents.map((d) => ({ key: `document:${d.slug}`, fields: { title: d.title, description: d.description } })),
  )
  // Only what a list card shows — nothing else needed before the detail page.
  const translatedDocuments = documents.map((d, i) => ({
    slug: d.slug,
    title: fields[i].title,
    description: fields[i].description,
    category: d.category,
    fileType: d.fileType,
    fileSize: d.fileSize,
    date: d.date,
  }))

  return <DocumentsView documents={translatedDocuments} locale={locale} t={t.documents} />
}
