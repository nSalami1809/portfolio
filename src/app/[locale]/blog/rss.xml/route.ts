import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultBlogPosts } from '@/data/defaultData'
import { translateFieldsBatch } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'
const MAX_ITEMS = 30

// RSS feed of the blog, one per language (/fr/blog/rss.xml, /en/blog/rss.xml).
export const revalidate = 300

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolioSafe('blog/rss')
  const posts = (portfolio?.blog ?? defaultBlogPosts)
    .filter((p) => p.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_ITEMS)

  const fields = await translateFieldsBatch(
    locale,
    posts.map((p) => ({ key: `blog:${p.slug}`, fields: { title: p.title, excerpt: p.excerpt } })),
  )

  const items = posts.map((p, i) => {
    const link = `${BASE}/${locale}/blog/${p.slug}`
    const date = new Date(p.date)
    return `    <item>
      <title>${xml(fields[i].title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      ${Number.isNaN(date.getTime()) ? '' : `<pubDate>${date.toUTCString()}</pubDate>`}
      <category>${xml(p.category)}</category>
      <description>${xml(fields[i].excerpt)}</description>
    </item>`
  })

  const lastBuild = posts.length && !Number.isNaN(new Date(posts[0].date).getTime()) ? new Date(posts[0].date) : new Date()
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(`Nawaf Nemrod Salami — ${t.blog.title}`)}</title>
    <link>${BASE}/${locale}/blog</link>
    <description>${xml(t.blog.subtitle)}</description>
    <language>${locale}</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${BASE}/${locale}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>
`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  })
}
