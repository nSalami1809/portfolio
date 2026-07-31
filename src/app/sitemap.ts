import type { MetadataRoute } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'
import { LOCALES } from '@/lib/i18n/locale'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const portfolio = await fetchPortfolio().catch(() => null)

  const entries: MetadataRoute.Sitemap = []

  for (const locale of LOCALES) {
    const base = `${BASE}/${locale}`

    entries.push(
      { url: base,               lastModified: new Date(), changeFrequency: 'weekly',  priority: locale === 'fr' ? 1 : 0.9 },
      { url: `${base}/projects`, lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
      { url: `${base}/offres`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
      { url: `${base}/resume`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
      { url: `${base}/blog`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
      { url: `${base}/vision`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
      { url: `${base}/contact`,  lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.5 },
    )

    for (const p of portfolio?.projects ?? []) {
      entries.push({ url: `${base}/projects/${p.slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 })
    }

    for (const p of (portfolio?.blog ?? []).filter((post) => post.published)) {
      entries.push({ url: `${base}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: 'monthly', priority: 0.5 })
    }
  }

  return entries
}
