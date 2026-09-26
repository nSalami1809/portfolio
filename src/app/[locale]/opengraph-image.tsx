import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { HOME_COPY } from '@/lib/seo'
import { ogCard, OG_SIZE } from '@/lib/og-card'

export const alt = 'Nawaf Nemrod Salami — Fullstack & DevOps'
export const size = OG_SIZE
export const contentType = 'image/png'

// Localized card for the home page (and the pages that have none of their own).
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  return ogCard({
    kicker: locale === 'en' ? 'Available for missions' : 'Disponible pour missions',
    title: 'Nawaf Nemrod Salami',
    subtitle: HOME_COPY[locale].title,
    tags: ['Next.js', 'TypeScript', 'Docker', 'Kubernetes', 'Node.js'],
  })
}
