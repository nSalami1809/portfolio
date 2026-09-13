'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useDictionary()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const links = [
    {
      href: `/${locale}`,
      label: t.nav.about,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
          <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
          <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
          <path d="M2 12a10 10 0 0 1 18-6"/>
          <path d="M2 16h.01"/>
          <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
          <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/>
          <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
          <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/resume`,
      label: t.nav.resume,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/vision`,
      label: t.nav.vision,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="14.31" y1="8" x2="20.05" y2="17.94"/>
          <line x1="9.69" y1="8" x2="21.17" y2="8"/>
          <line x1="7.38" y1="12" x2="13.12" y2="2.06"/>
          <line x1="9.69" y1="16" x2="3.95" y2="6.06"/>
          <line x1="14.31" y1="16" x2="2.83" y2="16"/>
          <line x1="16.62" y1="12" x2="10.88" y2="21.94"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/projects`,
      label: t.nav.projects,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
          <path d="M9 2v2"/><path d="M15 2v2"/><path d="M9 20v2"/><path d="M15 20v2"/>
          <path d="M2 9h2"/><path d="M2 15h2"/><path d="M20 9h2"/><path d="M20 15h2"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/offres`,
      label: t.nav.offers,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2.83 12.83A2 2 0 0 1 2 11.17V4a2 2 0 0 1 2-2h7.17a2 2 0 0 1 1.42.59l7.98 7.99a2 2 0 0 1 .02 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/calendrier`,
      label: t.nav.calendar,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/blog`,
      label: t.nav.blog,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/playground`,
      label: t.nav.playground,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="6 9 10 12 6 15"/><line x1="12" y1="15" x2="16" y2="15"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/contact`,
      label: t.nav.contact,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
        </svg>
      ),
    },
  ]

  const otherLocale = locale === 'fr' ? 'en' : 'fr'
  const restOfPath = (pathname ?? '').replace(/^\/(fr|en)/, '') || '/'
  const switchHref = `/${otherLocale}${restOfPath === '/' ? '' : restOfPath}`

  const switchLocale = () => {
    document.cookie = `NEXT_LOCALE=${otherLocale}; path=/; max-age=${60 * 60 * 24 * 365}`
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <header
        style={{
          background: scrolled ? 'var(--glass-bg)' : 'transparent',
          borderBottom: scrolled ? '1px solid var(--glass-border)' : '1px solid transparent',
          backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          boxShadow: scrolled ? 'inset 0 1px 0 var(--glass-highlight)' : 'none',
        }}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      >
        <nav aria-label={t.nav.ariaMain} className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Logo — single black asset, inverted to white in dark mode via
              CSS so switching themes never triggers a second image fetch. */}
          <Link href={`/${locale}`} aria-label={t.nav.home} className="flex items-center">
            <Image
              src="/logo-black.png"
              alt="Nawaf Nemrod SALAMI"
              width={50}
              height={50}
              priority
              style={{ width: 50, height: 50 }}
              className="dark:invert"
            />
          </Link>

          {/* Desktop nav — floating square capsule (rounded-xl resolves to 0
              via this site's zeroed --radius tokens, matching the square
              design language everywhere else) holding every link plus the
              language switch and theme toggle. Active item shown as a solid
              filled pill; plain conditional backgrounds (no layout-animated
              pill) keep this to a single style recalculation per hover, no
              extra JS. */}
          <div
            className="hidden lg:flex items-center rounded-xl p-1"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            <ul className="flex items-center" onMouseLeave={() => setHovered(null)}>
              {links.map(({ href, label, icon }) => {
                const isActive = pathname === href
                const isHovered = hovered === href
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onMouseEnter={() => setHovered(href)}
                      aria-current={isActive ? 'page' : undefined}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors duration-150"
                      style={{
                        background: isActive ? 'var(--accent)' : isHovered ? 'var(--surface-hover)' : 'transparent',
                        color: isActive ? 'var(--accent-contrast)' : isHovered ? 'var(--text)' : 'var(--text-muted)',
                        fontFamily: 'var(--font-poppins)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="transition-colors duration-150"
                        style={{ color: isActive ? 'var(--accent-contrast)' : isHovered ? 'var(--accent)' : 'var(--text-subtle)' }}
                      >
                        {icon}
                      </span>
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="w-px h-5 mx-1.5 flex-shrink-0" style={{ background: 'var(--border)' }} aria-hidden="true" />

            <Link
              href={switchHref}
              onClick={switchLocale}
              className="inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-150"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
            >
              {otherLocale.toUpperCase()}
            </Link>

            <ThemeToggle ariaLabel={t.nav.themeToggle} />
          </div>

          {/* Right controls (mobile/tablet only — desktop has these inside the pill above) */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle ariaLabel={t.nav.themeToggle} />

            {/* Language switcher */}
            <Link
              href={switchHref}
              onClick={switchLocale}
              className="hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', fontFamily: 'var(--font-poppins)' }}
            >
              {otherLocale.toUpperCase()}
            </Link>

            {/* Hamburger */}
            <button
              onClick={() => setOpen(!open)}
              aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="lg:hidden flex flex-col justify-center gap-1.5 w-9 h-9 rounded-lg transition-colors duration-200"
              style={{ background: open ? 'var(--surface-hover)' : 'transparent' }}
            >
              <m.span
                animate={open ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
                className="block w-5 h-0.5 mx-auto origin-center"
                style={{ background: 'var(--text)' }}
              />
              <m.span
                animate={open ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                className="block w-5 h-0.5 mx-auto"
                style={{ background: 'var(--text)' }}
              />
              <m.span
                animate={open ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
                className="block w-5 h-0.5 mx-auto origin-center"
                style={{ background: 'var(--text)' }}
              />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <m.div
            id="mobile-menu"
            role="dialog"
            aria-label={t.nav.menuAria}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 lg:hidden flex flex-col"
            style={{ background: 'var(--bg)', paddingTop: '5rem' }}
          >
            <ul className="flex flex-col p-6 gap-1.5">
              {links.map(({ href, label, icon }, i) => {
                const isActive = pathname === href
                return (
                  <m.li
                    key={href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 + 0.05 }}
                  >
                    <Link
                      href={href}
                      aria-current={isActive ? 'page' : undefined}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors duration-200"
                      style={{
                        color: isActive ? 'var(--accent)' : 'var(--text)',
                        background: isActive ? 'var(--accent-glow)' : 'transparent',
                        fontFamily: 'var(--font-space-grotesk)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                        style={{
                          background: isActive ? 'var(--accent-glow)' : 'var(--surface)',
                          color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {icon}
                      </span>
                      <span className="flex-1">{label}</span>
                      {isActive && (
                        <m.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          style={{ color: 'var(--accent)', fontSize: '18px', lineHeight: 1 }}
                        >
                          →
                        </m.span>
                      )}
                    </Link>
                  </m.li>
                )
              })}
              <m.li
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: links.length * 0.04 + 0.05 }}
              >
                <Link
                  href={switchHref}
                  onClick={switchLocale}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors duration-200"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-space-grotesk)' }}
                >
                  <span
                    aria-hidden="true"
                    className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 text-xs font-bold"
                    style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
                  >
                    {otherLocale.toUpperCase()}
                  </span>
                  {t.nav.switchTo}
                </Link>
              </m.li>
              <m.li
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (links.length + 1) * 0.04 + 0.05 }}
                className="flex items-center justify-between gap-3 px-4 py-3.5"
              >
                <span className="text-base font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-space-grotesk)' }}>
                  {t.nav.themeToggle}
                </span>
                <ThemeToggle ariaLabel={t.nav.themeToggle} />
              </m.li>
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
