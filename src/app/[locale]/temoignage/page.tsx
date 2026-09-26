import FadeIn from '@/components/animations/FadeIn'
import TestimonialForm from '@/components/sections/TestimonialForm'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { pageMeta } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  return pageMeta({ locale, path: '/temoignage', title: locale === 'en' ? 'Leave a review' : 'Laisser un avis', extra: { robots: { index: false, follow: true } } })
}

export default async function TestimonialPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  return (
    <div className="relative">
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-20">
        <FadeIn className="text-center mb-10">
          <p className="section-label mb-3">{t.testimonialPage.label}</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
            {t.testimonialPage.title}
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
            {t.testimonialPage.subtitle}
          </p>
        </FadeIn>

        <FadeIn delay={0.15}>
          <TestimonialForm t={t.testimonialPage.form} />
        </FadeIn>
      </div>
    </div>
  )
}
