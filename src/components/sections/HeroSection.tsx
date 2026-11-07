'use client'

import Link from 'next/link'
import { m } from 'framer-motion'
import type { PersonalInfo, SocialLinks } from '@/types'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import Icon, { type IconName } from '@/components/ui/Icon'
import PhotoLightbox from '@/components/ui/PhotoLightbox'

// One short entrance for the content of the hero (a fade and a small rise, one after the other), nothing else moves.
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

interface Props {
  personal: PersonalInfo
  socials: SocialLinks
  locale: Locale
  t: Dictionary['home']
  // Rendered on the server behind its own Suspense boundary and slotted in
  // here, so the bookings query it needs never blocks the headline.
  nextSlotBadge?: React.ReactNode
  // The example quote, on the right of the text from the large breakpoint up (under the buttons on a phone)
  aside?: React.ReactNode
}

const SOCIAL_BUTTON =
  'w-10 h-10 flex items-center justify-center transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'

export default function HeroSection({ personal, socials, locale, t, nextSlotBadge, aside }: Props) {
  const socialLinks: { href: string | undefined; icon: IconName; label: string; external: boolean }[] = [
    { href: socials.github, icon: 'github', label: 'GitHub', external: true },
    { href: socials.linkedin, icon: 'linkedin', label: 'LinkedIn', external: true },
    { href: socials.facebook, icon: 'facebook', label: 'Facebook', external: true },
    { href: socials.instagram, icon: 'instagram', label: 'Instagram', external: true },
    { href: personal.email ? `mailto:${personal.email}` : undefined, icon: 'mail', label: 'Email', external: false },
  ]

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full pt-12 pb-16 md:py-16">
        <div className={aside ? 'grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] gap-12 lg:gap-16 items-center' : ''}>
          {/* initial={false} (not "hidden"): framer-motion serializes whatever
              `initial` resolves to into the SSR inline style, so `initial="hidden"`
              shipped the entire above-the-fold hero — headline included — as
              opacity:0, invisible until hydration. Skipping the initial state
              paints the real markup immediately. */}
          <m.div variants={container} initial={false} animate="show" className="min-w-0">
            {/* Who: the photo (it opens large), the name, the role as search engines read it */}
            <m.div variants={item} className="flex items-center gap-4 mb-6">
              {personal.photo && (
                <PhotoLightbox src={personal.photo} alt={personal.name} openLabel={t.heroPhotoOpen} closeLabel={t.heroPhotoClose} />
              )}
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold m-0" style={{ color: 'var(--text)' }}>{personal.name}</p>
                <p className="section-label m-0 mt-1">{t.heroRoleLabel}</p>
              </div>
            </m.div>

            <m.div variants={item} className="flex flex-wrap items-center gap-2 mb-8">
              <div
                className="inline-flex items-center gap-2 px-3 h-8"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                <span className="inline-block w-1.5 h-1.5 flex-shrink-0" style={{ background: '#008000' }} aria-hidden="true" />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                  {t.heroAvailable}
                </span>
              </div>

              {nextSlotBadge}
            </m.div>

            <m.h1
              variants={item}
              className="font-display font-semibold leading-[1.05] mb-6 max-w-3xl"
              style={{ fontSize: 'clamp(2.25rem, 5.2vw, 4.25rem)', letterSpacing: '-0.03em', color: 'var(--text)' }}
            >
              {t.heroTitle}
            </m.h1>

            {/* The biography written in the back office; the standard two sentences while it is empty */}
            <m.p variants={item} className="text-lg leading-relaxed mb-8 max-w-2xl" style={{ color: 'var(--text-muted)' }}>
              {personal.bio?.trim() || t.heroSummary}
            </m.p>

            {/* The quote first (clients), the projects, and for recruiters a button of the same kind to the experience page */}
            <m.div variants={item} className="flex flex-wrap gap-4 mb-10">
              <Link href={`/${locale}/devis`} className="btn-primary">
                {t.heroCtaQuote}
                <Icon name="arrowRight" size={16} />
              </Link>
              <Link href={`/${locale}/projects`} className="btn-secondary">
                {t.heroCtaProjects}
              </Link>
              <Link href={`/${locale}/resume`} className="btn-secondary">
                {t.heroRecruit}
              </Link>
            </m.div>

            <m.ul variants={item} className="flex items-center gap-2 list-none p-0 m-0">
              {socialLinks.filter((l) => l.href).map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    aria-label={l.label}
                    className={SOCIAL_BUTTON}
                    style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  >
                    <Icon name={l.icon} size={18} />
                  </a>
                </li>
              ))}
            </m.ul>
          </m.div>

          {aside && <div className="min-w-0 lg:justify-self-end w-full">{aside}</div>}
        </div>
      </div>
    </section>
  )
}
