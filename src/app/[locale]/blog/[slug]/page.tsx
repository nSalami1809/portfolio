import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultBlogPosts } from '@/data/defaultData'
import { translateFields } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import BlogPostView from './BlogPostView'
import NotFoundMessage from '@/components/NotFoundMessage'

async function getPost(slug: string) {
  const portfolio = await fetchPortfolioSafe('blog/[slug]/page')
  const posts = portfolio?.blog ?? defaultBlogPosts
  return posts.find((p) => p.slug === slug && p.published) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { robots: { index: false, follow: false } }

  return {
    title: post.title,
    description: post.excerpt,
    authors: post.author ? [{ name: post.author }] : undefined,
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
      authors: post.author ? [post.author] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const post = await getPost(slug)
  if (!post) {
    return <NotFoundMessage locale={locale} t={t.notFound} />
  }

  const translated = await translateFields(`blog:${slug}`, locale, {
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: translated.title,
    description: translated.excerpt,
    image: post.coverImage || undefined,
    datePublished: post.date,
    author: { '@type': 'Person', name: post.author || 'Nawaf Nemrod Salami' },
    mainEntityOfPage: `${siteUrl}/${locale}/blog/${slug}`,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogPostView post={{ ...post, ...translated }} locale={locale} t={t.blog} />
    </>
  )
}
