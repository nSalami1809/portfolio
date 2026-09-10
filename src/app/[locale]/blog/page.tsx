import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { translateFields } from '@/lib/translate'
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

  const translatedPosts = await Promise.all(
    posts.map(async (p) => {
      const fields = await translateFields(`blog:${p.slug}`, locale, { title: p.title, excerpt: p.excerpt })
      return { ...p, title: fields.title, excerpt: fields.excerpt }
    }),
  )

  return <BlogPageView posts={translatedPosts} locale={locale} t={t.blog} />
}
