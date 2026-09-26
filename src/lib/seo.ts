// Shared SEO building blocks: per-page metadata with canonical + hreflang
// alternates (the site exists in French and English at /fr and /en) and the
// matching Open Graph / Twitter tags, so every page tells search engines and
// social networks which language it is, where its twin lives, and which URL is
// the reference one.
import type { Metadata } from 'next'
import type { Locale } from '@/lib/i18n/locale'

const OG_LOCALE: Record<Locale, string> = { fr: 'fr_FR', en: 'en_US' }
const SITE_NAME = 'Nawaf Nemrod Salami'

function alternatesFor(locale: Locale, path = ''): NonNullable<Metadata['alternates']> {
  return {
    canonical: `/${locale}${path}`,
    languages: { fr: `/fr${path}`, en: `/en${path}`, 'x-default': `/fr${path}` },
  }
}

interface PageMetaOptions {
  locale: Locale
  path?: string
  title: string
  description?: string
  image?: string
  type?: 'website' | 'article'
  // Anything else (robots, authors, publishedTime…) layered on top.
  extra?: Metadata
}

export function pageMeta({ locale, path = '', title, description, image, type = 'website', extra }: PageMetaOptions): Metadata {
  const other: Locale = locale === 'fr' ? 'en' : 'fr'
  return {
    title,
    description,
    alternates: alternatesFor(locale, path),
    openGraph: {
      type,
      url: `/${locale}${path}`,
      title,
      description,
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      alternateLocale: [OG_LOCALE[other]],
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    ...extra,
  }
}

// Home page copy (the layout's default title is French-only).
export const HOME_COPY: Record<Locale, { title: string; description: string }> = {
  fr: {
    title: 'Développeur web fullstack & DevOps à Libreville, Gabon',
    description: "Sites et applications web sur mesure, devis instantané en ligne, contrat signé en ligne et suivi jusqu'à la livraison. Développeur fullstack et DevOps basé à Libreville, Gabon.",
  },
  en: {
    title: 'Fullstack web developer & DevOps in Libreville, Gabon',
    description: 'Custom websites and web applications, instant online quote, contract signed online and follow-up through to delivery. Fullstack and DevOps developer based in Libreville, Gabon.',
  },
}
