import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import FadeIn from '@/components/animations/FadeIn'
import HeroSection from '@/components/sections/HeroSection'
import TestimonialsMarquee from '@/components/sections/TestimonialsMarquee'
import NextSlotBadge, { NEXT_SLOT_BADGE_HEIGHT } from '@/components/sections/NextSlotBadge'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { translateFieldsBatch } from '@/lib/translate'
import { jsonLdScript } from '@/lib/json-ld'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale'
import type { Testimonial } from '@/types'
import {
  defaultPersonalInfo,
  defaultSocials,
  defaultSkills,
  defaultTestimonials,
} from '@/data/defaultData'

// Regenerate at most once every 30s; invalidated instantly on admin publish via revalidatePath
export const revalidate = 30

// Reserves the marquee's exact height so the Suspense fallback below swapping
// for real content can never shift the page (the whole point of giving a
// boundary a fixed-size skeleton rather than a spinner).
const MARQUEE_HEIGHT = 240

function TestimonialsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse"
      style={{ height: MARQUEE_HEIGHT, background: 'var(--surface)', opacity: 0.5 }}
    />
  )
}

// Split out of the page body so the testimonial translations — the slowest
// and least important thing on the homepage — stream in behind their own
// boundary instead of holding back the hero and the whole document with them.
async function TranslatedTestimonials({
  testimonials,
  fieldsPromise,
  locale,
  verifiedLabel,
}: {
  testimonials: Testimonial[]
  fieldsPromise: Promise<{ text: string; role: string; company: string }[]>
  locale: Locale
  verifiedLabel: string
}) {
  const fields = await fieldsPromise
  const translated = testimonials.map((tm, i) => ({
    ...tm,
    text: fields[i].text,
    role: fields[i].role,
    company: fields[i].company,
  }))
  return (
    <TestimonialsMarquee testimonials={translated} locale={locale} verifiedLabel={verifiedLabel} />
  )
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolioSafe('[locale]/page')

  const personal     = portfolio?.personal     ?? defaultPersonalInfo
  const socials      = portfolio?.socials      ?? defaultSocials
  const skills       = portfolio?.skills       ?? defaultSkills
  const testimonials = portfolio?.testimonials ?? defaultTestimonials

  // Deliberately NOT awaited here: this promise is handed to the Suspense
  // boundary further down so the rest of the page never waits on it.
  const testimonialFieldsPromise = translateFieldsBatch(
    locale,
    testimonials.map((tm) => ({
      key: `testimonial:${tm.id}`,
      fields: { text: tm.text, role: tm.role ?? '', company: tm.company ?? '' },
    })),
  )

  // The bio translation is the only thing the hero genuinely has to wait for.
  // The "next open slot" badge, which needs a bookings query, now renders in
  // its own Suspense boundary inside the hero instead of gating it.
  const [bioFields] = await translateFieldsBatch(locale, [
    { key: 'personal:bio', fields: { bio: personal.bio } },
  ])
  const translatedPersonal = { ...personal, bio: bioFields.bio }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'
  const sameAs = [socials.linkedin, socials.github, socials.facebook, socials.instagram].filter(Boolean)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': `${siteUrl}/#person`,
        name: personal.name,
        jobTitle: personal.role,
        description: personal.bio,
        email: personal.email || undefined,
        url: siteUrl,
        image: personal.photo || undefined,
        sameAs: sameAs.length ? sameAs : undefined,
        address: personal.location ? { '@type': 'PostalAddress', addressLocality: personal.location } : undefined,
        knowsAbout: skills.flatMap((s) => s.items),
        knowsLanguage: ['fr', 'en'],
      },
      {
        '@type': 'ProfessionalService',
        '@id': `${siteUrl}/#service`,
        name: personal.name,
        description: personal.bio,
        url: siteUrl,
        image: personal.photo || undefined,
        areaServed: 'Worldwide',
        address: personal.location ? { '@type': 'PostalAddress', addressLocality: personal.location } : undefined,
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      {/* ── HERO ── */}
      <HeroSection
        personal={translatedPersonal}
        socials={socials}
        locale={locale}
        t={t.home}
        nextSlotBadge={
          <Suspense fallback={<div aria-hidden="true" style={{ height: NEXT_SLOT_BADGE_HEIGHT }} />}>
            <NextSlotBadge locale={locale} prefix={t.home.nextSlotPrefix} />
          </Suspense>
        }
      />

      {/* ── À PROPOS ── */}
      <section id="apropos" className="py-24" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeIn>
              <p className="section-label mb-4">{t.home.aboutLabel}</p>
              <h2 className="section-title mb-6">
                {t.home.aboutTitleStart}{' '}
                <span style={{ color: 'var(--accent)' }}>{t.home.aboutTitleHighlight}</span>
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
                    <p className="font-display font-bold text-4xl mb-2" style={{ color: 'var(--accent)' }}>{value}</p>
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
      <section className="py-24 overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <p className="section-label mb-4">{t.home.testimonialsLabel}</p>
            <h2 className="section-title mb-6">{t.home.testimonialsTitle}</h2>
            {testimonials.length === 0 && (
              <p className="mb-6" style={{ color: 'var(--text-muted)' }}>{t.home.testimonialsEmpty}</p>
            )}
            <Link href={`/${locale}/temoignage`} className="btn-secondary">
              {t.home.testimonialsCta}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </FadeIn>
        </div>

        {testimonials.length > 0 && (
          <FadeIn delay={0.1}>
            <Suspense fallback={<TestimonialsSkeleton />}>
              <TranslatedTestimonials
                testimonials={testimonials}
                fieldsPromise={testimonialFieldsPromise}
                locale={locale}
                verifiedLabel={t.home.testimonialsVerified}
              />
            </Suspense>
          </FadeIn>
        )}
      </section>

      {/* ── CTA ── */}
      <section className="py-24" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <FadeIn>
            <div
              className="p-6 sm:p-12"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
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
