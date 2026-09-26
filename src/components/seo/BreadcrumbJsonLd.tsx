'use client'

import { usePathname } from 'next/navigation'
import JsonLd from './JsonLd'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

// Breadcrumb trail (Home > Page) for every top-level public page, derived from
// the URL so it lives in one place instead of being repeated in each page.
// usePathname() resolves during prerender, so this is in the server-rendered
// HTML that crawlers read. Detail pages (blog/project) publish their own
// richer structured data and are skipped here, as are private pages.
export default function BreadcrumbJsonLd({ locale, t }: { locale: Locale; t: Dictionary['nav'] }) {
  const pathname = usePathname() ?? ''
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 2) return null

  const labels: Record<string, string> = {
    resume: t.resume, vision: t.vision, projects: t.projects, offres: t.workOffers, methode: t.workMethod, blog: t.blog,
    playground: t.playground, contact: t.contact, devis: t.workQuote, calendrier: t.workCall, cgv: t.workTerms,
  }
  const name = labels[segments[1]]
  if (!name) return null

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: `${SITE_URL}/${locale}` },
          { '@type': 'ListItem', position: 2, name, item: `${SITE_URL}/${locale}/${segments[1]}` },
        ],
      }}
    />
  )
}
