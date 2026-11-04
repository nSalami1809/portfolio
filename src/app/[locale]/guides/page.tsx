import type { Metadata } from 'next'
import Link from 'next/link'
import FadeIn from '@/components/animations/FadeIn'
import Icon from '@/components/ui/Icon'
import { GUIDES } from '@/data/guides'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { pageMeta } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  return pageMeta({ locale, path: '/guides', title: t.guides.title, description: t.guides.subtitle })
}

// Static: the guides are written in the code, so the list needs no data and is built once per language.
export default async function GuidesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const dateFormat = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
      <FadeIn>
        <p className="section-label mb-3">{t.guides.label}</p>
        <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>{t.guides.title}</h1>
        <p className="text-lg mb-14" style={{ color: 'var(--text-muted)', maxWidth: 620 }}>{t.guides.subtitle}</p>
      </FadeIn>

      <ul className="grid md:grid-cols-2 gap-6 list-none p-0 m-0">
        {GUIDES.map((guide, i) => {
          const g = guide[locale]
          return (
            <li key={guide.slug}>
              <FadeIn delay={Math.min(i * 0.08, 0.3)}>
                <Link href={`/${locale}/guides/${guide.slug}`} className="card p-6 h-full flex flex-col" data-testid="guide-card">
                  <Icon name="blog" size={28} className="mb-4" style={{ color: 'var(--brand, var(--accent))' }} />
                  <h2 className="font-display font-semibold text-xl mb-2" style={{ color: 'var(--text)' }}>{g.title}</h2>
                  <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: 'var(--text-muted)' }}>{g.description}</p>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                    {t.guides.readTime(g.readMinutes)} · {t.guides.updated} {dateFormat.format(new Date(guide.updated))}
                  </p>
                  <span className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {t.guides.read}<Icon name="arrowRight" size={14} />
                  </span>
                </Link>
              </FadeIn>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
