import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultBlogPosts } from '@/data/defaultData'
import { translateFields } from '@/lib/translate'
import { jsonLdScript } from '@/lib/json-ld'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import BlogPostView from './BlogPostView'
import NotFoundMessage from '@/components/NotFoundMessage'
import { LOCALES } from '@/lib/i18n/locale'
import { pageMeta } from '@/lib/seo'

// Regenerate at most once every 30s, matching every sibling route;
// invalidated instantly on admin publish via updateTag('portfolio').
export const revalidate = 30

// Without this, both locales of every post rendered on demand — and the EN
// render blocks inside TTFB on a Gemini translation of the full article body
// the first time it is requested. Prerendering at build time moves that cost
// off the visitor's request entirely.
export async function generateStaticParams() {
  const portfolio = await fetchPortfolioSafe('blog/[slug]/generateStaticParams')
  const posts = (portfolio?.blog ?? defaultBlogPosts).filter((p) => p.published)
  return LOCALES.flatMap((locale) => posts.map((p) => ({ locale, slug: p.slug })))
}

async function getPost(slug: string) {
  const portfolio = await fetchPortfolioSafe('blog/[slug]/page')
  const posts = portfolio?.blog ?? defaultBlogPosts
  return posts.find((p) => p.slug === slug && p.published) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const post = await getPost(slug)
  if (!post) return { robots: { index: false, follow: false } }

  // Same cached translation the page itself uses: the title and description
  // shown in search results are in the language of the page.
  const translated = await translateFields(`blog:${slug}`, locale, { title: post.title, excerpt: post.excerpt, content: post.content })

  return pageMeta({
    locale,
    path: `/blog/${slug}`,
    title: translated.title,
    description: translated.excerpt,
    image: post.coverImage || undefined,
    type: 'article',
    extra: {
      authors: post.author ? [{ name: post.author }] : undefined,
      openGraph: {
        type: 'article',
        url: `/${locale}/blog/${slug}`,
        title: translated.title,
        description: translated.excerpt,
        publishedTime: post.date,
        authors: post.author ? [post.author] : undefined,
        ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
      },
    },
  })
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <BlogPostView post={{ ...post, ...translated }} locale={locale} t={t.blog} />
    </>
  )
}
