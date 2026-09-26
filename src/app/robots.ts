import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The admin, the API, and the private per-client pages (signature and
        // acceptance links, project tracking) have no business in a search index.
        disallow: [
          '/admin/',
          '/api/',
          '/fr/devis/signature/',
          '/en/devis/signature/',
          '/fr/recette/',
          '/en/recette/',
          '/fr/suivi',
          '/en/suivi',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
