import type { MetadataRoute } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { LOCALES } from '@/lib/i18n/locale'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

// Rebuilt hourly: a blog post or project published from the admin joins the
// sitemap without waiting for the next deploy.
export const revalidate = 3600

// Every URL exists in both languages: each entry lists its twin (hreflang), so
// search engines serve the right language and never treat them as duplicates.
function entry(
  path: string,
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>,
  priority: number,
  lastModified?: Date,
): MetadataRoute.Sitemap {
  const languages = { fr: `${BASE}/fr${path}`, en: `${BASE}/en${path}`, 'x-default': `${BASE}/fr${path}` }
  return LOCALES.map((locale) => ({
    url: `${BASE}/${locale}${path}`,
    changeFrequency,
    // Homepage's French version is the reference one.
    priority: locale === 'fr' ? priority : Math.max(0.1, priority - 0.1),
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages },
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const portfolio = await fetchPortfolioSafe('sitemap')

  // No lastModified on the static pages: claiming "modified just now" on every
  // crawl teaches Google to ignore the field. It is only stated where it is
  // true — a blog post's own date.
  const entries: MetadataRoute.Sitemap = [
    ...entry('', 'weekly', 1),
    ...entry('/projects', 'weekly', 0.8),
    ...entry('/offres', 'monthly', 0.8),
    ...entry('/methode', 'monthly', 0.7),
    ...entry('/devis', 'monthly', 0.6),
    ...entry('/resume', 'monthly', 0.7),
    ...entry('/blog', 'weekly', 0.7),
    ...entry('/playground', 'monthly', 0.4),
    ...entry('/vision', 'monthly', 0.6),
    ...entry('/contact', 'yearly', 0.5),
    ...entry('/cgv', 'yearly', 0.3),
  ]

  for (const p of portfolio?.projects ?? []) entries.push(...entry(`/projects/${p.slug}`, 'monthly', 0.5))
  for (const p of (portfolio?.blog ?? []).filter((post) => post.published)) {
    const date = new Date(p.date)
    entries.push(...entry(`/blog/${p.slug}`, 'monthly', 0.5, Number.isNaN(date.getTime()) ? undefined : date))
  }

  return entries
}
