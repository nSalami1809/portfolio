import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import FadeIn from '@/components/animations/FadeIn'
import JsonLd from '@/components/seo/JsonLd'
import GuideBody from '@/components/guides/GuideBody'
import Icon from '@/components/ui/Icon'
import WhatsAppButton from '@/components/ui/WhatsAppButton'
import { GUIDES, getGuide } from '@/data/guides'
import { defaultOffers, defaultPersonalInfo } from '@/data/defaultData'
import { resolveBusiness } from '@/lib/business'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE, LOCALES } from '@/lib/i18n/locale'
import { fetchPortfolioSafe } from '@/lib/portfolio-data'
import { pageMeta } from '@/lib/seo'
import { whatsappLink } from '@/lib/whatsapp'

// The facts inside a guide (prices, terms, payment) come from the portfolio data: regenerate often,
// and at once when the admin publishes (same rule as the other pages).
export const revalidate = 30

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => GUIDES.map((g) => ({ locale, slug: g.slug })))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const guide = getGuide(slug)
  if (!guide) return { robots: { index: false, follow: false } }
  return pageMeta({ locale, path: `/guides/${slug}`, title: guide[locale].title, description: guide[locale].description, type: 'article' })
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const guide = getGuide(slug)
  if (!guide) notFound()

  const t = getDictionary(locale)
  const g = guide[locale]
  const portfolio = await fetchPortfolioSafe('guides/[slug]/page')
  const personal = portfolio?.personal ?? defaultPersonalInfo
  const offers = portfolio?.offers ?? defaultOffers
  const business = resolveBusiness(personal)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'
  const url = `${siteUrl}/${locale}/guides/${slug}`
  const dateFormat = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const whatsapp = whatsappLink(personal.whatsapp, { kind: 'guide', title: g.title }, locale, personal.name, url)

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.description,
    inLanguage: locale,
    datePublished: guide.updated,
    dateModified: guide.updated,
    author: { '@type': 'Person', name: personal.name },
    mainEntityOfPage: url,
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
      <JsonLd data={articleLd} />

      <FadeIn>
        <nav aria-label={t.guides.breadcrumb} className="mb-10">
          <Link href={`/${locale}/guides`} className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200 hover:text-[var(--accent)]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            <Icon name="arrowLeft" size={16} />
            {t.guides.allGuides}
          </Link>
        </nav>
        <p className="section-label mb-3">{t.guides.label}</p>
        <h1 className="section-title mb-5" style={{ fontSize: 'clamp(2rem,5vw,3.25rem)', maxWidth: 820 }}>{g.title}</h1>
        <p className="text-lg leading-relaxed mb-4" style={{ color: 'var(--text-muted)', maxWidth: 720 }}>{g.intro}</p>
        <p className="text-xs mb-14" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          {t.guides.readTime(g.readMinutes)} · {t.guides.updated} {dateFormat.format(new Date(guide.updated))}
        </p>
      </FadeIn>

      <div className="grid lg:grid-cols-[1fr_260px] gap-12 items-start">
        <article className="min-w-0 max-w-3xl">
          <GuideBody sections={g.sections} offers={offers} business={business} t={t.guides} work={t.work} locale={locale} />

          <aside className="card p-6 sm:p-8 mt-4" aria-labelledby="guide-cta-title" data-testid="guide-cta">
            <h2 id="guide-cta-title" className="font-display font-bold text-xl mb-2" style={{ color: 'var(--text)' }}>{g.ctaTitle}</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>{g.ctaText}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/${locale}/devis`} className="btn-primary text-sm">{t.guides.ctaQuote}</Link>
              <Link href={`/${locale}/offres#trouver-mon-offre`} className="btn-secondary text-sm">{t.guides.ctaFinder}</Link>
              <WhatsAppButton href={whatsapp} label={t.whatsapp.guideCta} />
            </div>
          </aside>
        </article>

        <nav aria-label={t.guides.toc} className="hidden lg:block sticky top-24" data-testid="guide-toc">
          <p className="section-label mb-4">{t.guides.toc}</p>
          <ol className="space-y-3 list-none p-0 m-0">
            {g.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-sm leading-snug transition-colors duration-200 hover:text-[var(--accent)]" style={{ color: 'var(--text-muted)' }}>{section.heading}</a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  )
}
