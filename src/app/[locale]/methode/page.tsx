import type { Metadata } from 'next'
import FadeIn from '@/components/animations/FadeIn'
import WorkProcess from '@/components/sections/WorkProcess'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { resolveBusiness } from '@/lib/business'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'

// Regenerate at most once every 30s; invalidated instantly on admin publish
export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const t = getDictionary(isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE)
  return { title: t.work.pageTitle, description: t.work.pageSubtitle }
}

export default async function MethodPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolioSafe('methode/page')
  // Same settings as the quote and the contract: the page can never promise a
  // delay, a deposit or a warranty the documents do not state.
  const terms = resolveBusiness(portfolio?.personal ?? defaultPersonalInfo)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <FadeIn>
        <p className="section-label mb-3">{t.work.pageLabel}</p>
        <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>{t.work.pageTitle}</h1>
        <p className="text-lg mb-16" style={{ color: 'var(--text-muted)', maxWidth: 620 }}>{t.work.pageSubtitle}</p>
      </FadeIn>
      <WorkProcess t={t.work} terms={terms} locale={locale} />
    </div>
  )
}
