import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { translateFieldsBatch } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { defaultBlogPosts } from '@/data/defaultData'
import BlogPageView from './BlogPageView'
import { pageMeta } from '@/lib/seo'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const meta = pageMeta({ locale, path: '/blog', title: t.blog.title, description: t.blog.subtitle })
  // Lets feed readers and browsers discover the RSS feed from the blog page.
  return { ...meta, alternates: { ...meta.alternates, types: { 'application/rss+xml': `/${locale}/blog/rss.xml` } } }
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
  // Only what a list card shows: the article bodies stay on their own pages
  // (spreading the whole post used to serialize every article into this one).
  const translatedPosts = posts.map((p, i) => ({
    slug: p.slug,
    title: fields[i].title,
    excerpt: fields[i].excerpt,
    date: p.date,
    category: p.category,
    readTime: p.readTime,
    coverImage: p.coverImage,
  }))

  return <BlogPageView posts={translatedPosts} locale={locale} t={t.blog} />
}
