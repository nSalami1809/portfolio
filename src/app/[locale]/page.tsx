import Link from 'next/link'
import Image from 'next/image'
import FadeIn from '@/components/animations/FadeIn'
import HeroSection from '@/components/sections/HeroSection'
import { fetchPortfolio } from '@/actions/portfolio'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import {
  defaultPersonalInfo,
  defaultSocials,
  defaultSkills,
  defaultTestimonials,
} from '@/data/defaultData'

// Regenerate at most once every 30s; invalidated instantly on admin publish via revalidatePath
export const revalidate = 30

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolio().catch(() => null)

  const personal     = portfolio?.personal     ?? defaultPersonalInfo
  const socials      = portfolio?.socials      ?? defaultSocials
  const skills       = portfolio?.skills       ?? defaultSkills
  const testimonials = portfolio?.testimonials ?? defaultTestimonials

  return (
    <>
      {/* ── HERO ── */}
      <HeroSection personal={personal} socials={socials} locale={locale} t={t.home} />

      {/* ── À PROPOS ── */}
      <section id="apropos" className="py-24" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeIn>
              <p className="section-label mb-4">{t.home.aboutLabel}</p>
              <h2 className="section-title mb-6">
                {t.home.aboutTitleStart}{' '}
                <span className="gradient-text">{t.home.aboutTitleHighlight}</span>
              </h2>
              <div className="space-y-4 text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                <p>{t.home.aboutP1}</p>
                <p>{t.home.aboutP2}</p>
              </div>
              <div className="mt-8">
                <Link href={`/${locale}/vision`} className="btn-secondary">
                  {t.home.aboutCta}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </Link>
              </div>
            </FadeIn>

            <FadeIn delay={0.1} direction="left">
              <div className="grid grid-cols-2 gap-4">
                {t.home.stats.map(({ value, label }) => (
                  <div key={label} className="card p-6 text-center">
                    <p className="font-display font-bold text-4xl mb-2 gradient-text">{value}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── STACK TECHNIQUE ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <p className="section-label mb-4">{t.home.stackLabel}</p>
            <h2 className="section-title">{t.home.stackTitle}</h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {skills.map((skill, i) => (
              <FadeIn key={skill.id} delay={Math.min(i * 0.07, 0.28)}>
                <div className="card p-6 h-full">
                  <p className="font-display font-semibold text-base mb-4" style={{ color: 'var(--accent)' }}>
                    {skill.category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {skill.items.map((item) => {
                      const icon = skill.icons?.[item]
                      return (
                        <div
                          key={item}
                          className="flex items-center gap-2 rounded-lg"
                          style={{
                            background: 'var(--surface-hover)',
                            border: '1px solid var(--border)',
                            padding: '0.4rem 0.8rem',
                          }}
                        >
                          {icon && (
                            <span
                              className="flex items-center justify-center rounded-md flex-shrink-0"
                              style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.92)' }}
                            >
                              <Image
                                src={icon}
                                alt=""
                                aria-hidden="true"
                                width={20}
                                height={20}
                                loading="lazy"
                                className="w-5 h-5 object-contain"
                              />
                            </span>
                          )}
                          <span
                            className="text-sm font-medium"
                            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
                          >
                            {item}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── TÉMOIGNAGES ── */}
      {testimonials.length > 0 && (
        <section className="py-24" style={{ background: 'var(--bg-secondary)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <FadeIn className="text-center mb-16">
              <p className="section-label mb-4">{t.home.testimonialsLabel}</p>
              <h2 className="section-title">{t.home.testimonialsTitle}</h2>
            </FadeIn>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((tm, i) => (
                <FadeIn key={tm.id} delay={Math.min(i * 0.08, 0.24)}>
                  <div className="card p-6 h-full flex flex-col">
                    <div className="mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)' }}>
                        <path
                          d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"
                          fill="currentColor"
                          opacity="0.4"
                        />
                      </svg>
                    </div>

                    <p className="text-sm leading-relaxed flex-1 mb-6" style={{ color: 'var(--text-muted)' }}>
                      {tm.text}
                    </p>

                    <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                      {tm.avatar ? (
                        <Image
                          src={tm.avatar}
                          alt={tm.name}
                          width={40}
                          height={40}
                          loading="lazy"
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-base"
                          style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
                        >
                          {tm.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>
                          {tm.name}
                        </p>
                        {(tm.role || tm.company) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                            {[tm.role, tm.company].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-24" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <FadeIn>
            <div
              className="rounded-2xl p-6 sm:p-12"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-glow)' }}
            >
              <p className="section-label mb-4">{t.home.ctaLabel}</p>
              <h2 className="section-title mb-6">{t.home.ctaTitle}</h2>
              <p className="mb-8 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
                {t.home.ctaText}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href={`/${locale}/contact`} className="btn-primary">{t.home.ctaButton1}</Link>
                <Link href={`/${locale}/contact`} className="btn-secondary">{t.home.ctaButton2}</Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
