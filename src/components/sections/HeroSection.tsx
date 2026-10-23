'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import type { PersonalInfo, SocialLinks } from '@/types'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import Icon from '@/components/ui/Icon'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

interface Props {
  personal: PersonalInfo
  socials: SocialLinks
  locale: Locale
  t: Dictionary['home']
  // Rendered on the server behind its own Suspense boundary and slotted in
  // here, so the bookings query it needs never blocks the headline.
  nextSlotBadge?: React.ReactNode
}

// Module-level, so it survives client-side navigations but NOT a fresh
// document load — exactly the distinction the typewriter below needs.
let heroMountedOnce = false

function TypingCursor() {
  return (
    <span
      aria-hidden="true"
      className="inline-block align-middle animate-pulse"
      style={{ width: 3, height: '0.85em', marginLeft: 3, background: 'var(--accent)' }}
    />
  )
}

export default function HeroSection({ personal, socials, locale, t, nextSlotBadge }: Props) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const line1 = t.heroGreeting
  const lastName = personal.name.split(' ').slice(-1)[0]
  const firstNames = personal.name.split(' ').slice(0, -1).join(' ')
  const boundary1 = line1.length
  const boundary2 = boundary1 + lastName.length
  const fullLength = boundary2 + firstNames.length

  // Seeded to the FULL length so the <h1> — the page's LCP element — is
  // present and complete in the server-rendered HTML. It used to start at 0,
  // which meant the biggest text block on the site was an empty node until
  // hydration finished, then spent another ~2.3s (700ms delay + 45ms/char)
  // filling itself in. The typewriter is now kept only for client-side
  // navigations back to the homepage, where there is no LCP to spoil.
  const [typed, setTyped] = useState(fullLength)

  useEffect(() => {
    const firstPaint = !heroMountedOnce
    heroMountedOnce = true

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (firstPaint || reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTyped(fullLength)
      return
    }

    setTyped(0)
    const startDelay = 300
    const speed = 45
    let interval: ReturnType<typeof setInterval> | undefined
    const timeout = setTimeout(() => {
      let i = 0
      interval = setInterval(() => {
        i++
        setTyped(i)
        if (i >= fullLength) clearInterval(interval)
      }, speed)
    }, startDelay)
    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [fullLength, personal.name])

  const t1 = line1.slice(0, Math.max(0, Math.min(line1.length, typed)))
  const t2 = lastName.slice(0, Math.max(0, Math.min(lastName.length, typed - boundary1)))
  const t3 = firstNames.slice(0, Math.max(0, Math.min(firstNames.length, typed - boundary2)))

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 40%, var(--accent-glow), transparent)' }}
      />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 w-full py-16">
        {/* Text */}
        {/* initial={false} (not "hidden"): framer-motion serializes whatever
            `initial` resolves to into the SSR inline style, so `initial="hidden"`
            shipped the entire above-the-fold hero — heading included — as
            opacity:0, invisible until hydration. Skipping the initial state
            paints the real markup immediately; the staggered entrance is kept
            only for the decorative bits that declare their own initial below. */}
        <m.div variants={container} initial={false} animate="show">
          {personal.photo && (
            <m.div variants={item} className="mb-6">
              <Image
                src={personal.photo}
                alt={personal.name}
                width={80}
                height={80}
                priority
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: '2px solid var(--accent)', boxShadow: '0 0 0 4px var(--accent-glow)' }}
              />
            </m.div>
          )}

          <m.div variants={item} className="flex flex-wrap items-center gap-2.5 mb-5">
            <div
              className="inline-flex items-center gap-2 px-3 h-8 rounded-xl"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <span className="inline-block w-1.5 h-1.5 flex-shrink-0" style={{ background: '#008000' }} aria-hidden="true" />
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                {t.heroAvailable}
              </span>
            </div>

            {nextSlotBadge}
          </m.div>

          <m.p variants={item} className="section-label mb-5">
            {t.heroRoleLabel}
          </m.p>

          <m.h1
            variants={item}
            className="font-display font-bold leading-[1.05] mb-6"
            style={{ fontSize: 'clamp(2.1rem, 7vw, 5.5rem)', letterSpacing: '-0.03em' }}
          >
            <span style={{ color: 'var(--text)' }}>
              {t1}
              {typed < boundary1 && <TypingCursor />}
            </span>
            <br />
            <span style={{ color: 'var(--accent)' }}>
              {t2}
              {typed >= boundary1 && typed < boundary2 && <TypingCursor />}
            </span>
            <br />
            <span style={{ color: 'var(--text)' }}>
              {t3}
              {typed >= boundary2 && <TypingCursor />}
            </span>
          </m.h1>

          <m.p
            variants={item}
            className="text-lg leading-relaxed mb-10 max-w-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            {personal.bio}
          </m.p>

          <m.div variants={item} className="flex flex-wrap gap-4 mb-10">
            <Link href={`/${locale}/projects`} className="btn-primary">
              {t.heroCtaProjects}
              <Icon name="arrowRight" size={16} />
            </Link>
            <Link href={`/${locale}/contact`} className="btn-secondary">
              {t.heroCtaContact}
            </Link>
          </m.div>

          {/* Socials — purely decorative and below the headline, so this one
              opts back in to an entrance animation with its own `initial`
              (the parent's initial={false} suppresses the variant one). */}
          <m.div
            className="flex items-center gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {socials.github && (
              <a href={socials.github} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="GitHub"
              >
                <Icon name="github" size={18} style={{ color: 'var(--text-muted)' }} />
              </a>
            )}
            {socials.linkedin && (
              <a href={socials.linkedin} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="LinkedIn"
              >
                <Icon name="linkedin" size={18} style={{ color: 'var(--text-muted)' }} />
              </a>
            )}
            {socials.facebook && (
              <a href={socials.facebook} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Facebook"
              >
                <Icon name="facebook" size={18} style={{ color: 'var(--text-muted)' }} />
              </a>
            )}
            {socials.instagram && (
              <a href={socials.instagram} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Instagram"
              >
                <Icon name="instagram" size={18} style={{ color: 'var(--text-muted)' }} />
              </a>
            )}
            {personal.email && (
              <a href={`mailto:${personal.email}`}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Email"
              >
                <Icon name="mail" size={18} style={{ color: 'var(--text-muted)' }} />
              </a>
            )}
          </m.div>
        </m.div>
      </div>

      {/* Scroll indicator */}
      <AnimatePresence>
        {!scrolled && (
          <m.a
            href="#apropos"
            aria-label={t.heroScrollAria}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 cursor-pointer group z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 8, 0] }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{
              opacity: { delay: 1.5 },
              y: { delay: 1.5, duration: 2, repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            <span
              className="text-xs font-semibold tracking-widest transition-colors duration-200 group-hover:opacity-100"
              style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-poppins)' }}
            >
              {t.heroScroll}
            </span>
            <div
              className="relative w-7 h-11 rounded-full flex justify-center pt-2.5 transition-transform duration-200 group-hover:scale-110"
              style={{
                border: '2px solid var(--accent)',
                background: 'var(--glass-bg)',
                boxShadow: '0 0 20px var(--accent-glow), inset 0 1px 0 var(--glass-highlight)',
              }}
            >
              <m.div
                animate={{ y: [0, 14, 0], opacity: [1, 0, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            </div>
          </m.a>
        )}
      </AnimatePresence>
    </section>
  )
}
