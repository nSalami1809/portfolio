import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { translateFieldsBatch } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { defaultBlogPosts } from '@/data/defaultData'
import BlogPageView from './BlogPageView'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  return { title: t.blog.title, description: t.blog.subtitle }
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolioSafe('blog/page')
  const posts = (portfolio?.blog ?? defaultBlogPosts).filter((p) => p.published)

  // One cache round trip for the whole list, not one per post.
  const fields = await translateFieldsBatch(
    locale,
    posts.map((p) => ({ key: `blog:${p.slug}`, fields: { title: p.title, excerpt: p.excerpt } })),
  )
  const translatedPosts = posts.map((p, i) => ({ ...p, title: fields[i].title, excerpt: fields[i].excerpt }))

  return <BlogPageView posts={translatedPosts} locale={locale} t={t.blog} />
}
