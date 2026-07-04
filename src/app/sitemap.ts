import type { MetadataRoute } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nawaf.dev'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const portfolio = await fetchPortfolio().catch(() => null)

  const projectEntries: MetadataRoute.Sitemap = (portfolio?.projects ?? []).map((p) => ({
    url: `${BASE}/projects/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const blogEntries: MetadataRoute.Sitemap = (portfolio?.blog ?? [])
    .filter((p) => p.published)
    .map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: 'monthly',
      priority: 0.6,
    }))

  return [
    { url: BASE,               lastModified: new Date(), changeFrequency: 'weekly',  priority: 1 },
    { url: `${BASE}/projects`, lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/resume`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/blog`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/vision`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contact`,  lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.6 },
    ...projectEntries,
    ...blogEntries,
  ]
}
