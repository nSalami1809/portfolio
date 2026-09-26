import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultBlogPosts } from '@/data/defaultData'
import { translateFields } from '@/lib/translate'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { ogCard, OG_SIZE } from '@/lib/og-card'

export const alt = 'Article du blog — Nawaf Nemrod Salami'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 3600

// Card shown when an article is shared (unless the article has its own cover
// image, which then takes precedence — see the page's metadata).
export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const portfolio = await fetchPortfolioSafe('blog/og')
  const post = (portfolio?.blog ?? defaultBlogPosts).find((p) => p.slug === slug && p.published)

  if (!post) return ogCard({ kicker: 'Blog', title: 'Nawaf Nemrod Salami' })

  // Same fields as the page itself, so the cached translation is reused.
  const t = await translateFields(`blog:${slug}`, locale, { title: post.title, excerpt: post.excerpt, content: post.content })
  return ogCard({ kicker: `Blog · ${post.category}`, title: t.title, subtitle: t.excerpt, tags: [post.readTime].filter(Boolean) })
}
