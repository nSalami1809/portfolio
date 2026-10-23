'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import ThemeToggle from './ThemeToggle'
import { HugeiconsIcon } from '@hugeicons/react'
import { File02Icon } from '@hugeicons/core-free-icons'
import Icon from '@/components/ui/Icon'

interface NavbarProps {
  locale: Locale
  // Only the `nav` slice, resolved server-side. Reaching for the whole
  // dictionary through a hook pulled ~30KB of bilingual copy into the shared
  // client bundle of every page just to label these links.
  t: Dictionary['nav']
}

export default function Navbar({ locale, t }: NavbarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  // Dropdown opened by a tap (touch screens have no hover) or a click.
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const links = [
    {
      href: `/${locale}`,
      label: t.about,
      icon: (
        <Icon name="about" size={14} />
      ),
    },
    {
      href: `/${locale}/resume`,
      label: t.resume,
      icon: (
        <Icon name="server" size={14} />
      ),
    },
    {
      href: `/${locale}/vision`,
      label: t.vision,
      icon: (
        <Icon name="vision" size={14} />
      ),
    },
    {
      href: `/${locale}/projects`,
      label: t.projects,
      icon: (
        <Icon name="cpu" size={14} />
      ),
    },
    {
      href: `/${locale}/offres`,
      label: t.offers,
      // Everything about working together lives under one entry: the price
      // list and method, the instant quote, booking a call, tracking a
      // project, and the terms of sale.
      children: [
        { href: `/${locale}/offres`, label: t.workOffers, icon: 'store' as const },
        { href: `/${locale}/methode`, label: t.workMethod, icon: 'target' as const },
        { href: `/${locale}/contact`, label: t.contact, icon: 'mail' as const },
        { href: `/${locale}/devis`, label: t.workQuote, icon: 'invoice' as const },
        { href: `/${locale}/calendrier`, label: t.workCall, icon: 'calendar' as const },
        { href: `/${locale}/suivi`, label: t.workTrack, icon: 'delivery' as const },
        { href: `/${locale}/cgv`, label: t.workTerms, icon: 'shield' as const },
      ],
      icon: (
        <Icon name="tag" size={14} />
      ),
    },
    {
      href: `/${locale}/blog`,
      label: t.blog,
      icon: (
        <Icon name="blog" size={14} />
      ),
    },
    {
      href: `/${locale}/documents`,
      label: t.documents,
      icon: <HugeiconsIcon icon={File02Icon} size={14} strokeWidth={2} />,
    },
    {
      href: `/${locale}/playground`,
      label: t.playground,
      icon: (
        <Icon name="lab" size={14} />
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
  useEffect(() => { setOpen(false); setMenuOpen(null) }, [pathname])

  // A tap (or click) anywhere outside an open dropdown closes it.
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.('[data-nav-dropdown]')) setMenuOpen(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

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
        {/* Three columns (logo | links | controls) with equal outer columns, so
            the link pill sits in the true centre of the page whatever its width. */}
        <nav aria-label={t.ariaMain} className="max-w-7xl mx-auto px-4 sm:px-6 h-20 grid grid-cols-[1fr_auto_1fr] items-center">
          {/* Logo — single black asset, inverted to white in dark mode via
              CSS so switching themes never triggers a second image fetch. */}
          <Link href={`/${locale}`} aria-label={t.home} className="flex items-center col-start-1 justify-self-start">
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
            className="hidden xl:flex items-center rounded-xl p-1 col-start-2"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            <ul className="flex items-center" onMouseLeave={() => setHovered(null)}>
              {links.map(({ href, label, icon, children }) => {
                const isActive = pathname === href || !!children?.some((c) => pathname === c.href)
                const isHovered = hovered === href
                return (
                  <li
                    key={href}
                    className="relative group"
                    data-nav-dropdown={children ? '' : undefined}
                    onKeyDown={children ? (e) => {
                      if (e.key === 'Escape') {
                        setMenuOpen(null)
                        // Dropping focus is what hides the keyboard-focus panel.
                        ;(document.activeElement as HTMLElement | null)?.blur()
                      }
                    } : undefined}
                  >
                    <Link
                      href={href}
                      onMouseEnter={() => setHovered(href)}
                      aria-current={isActive ? 'page' : undefined}
                      aria-haspopup={children ? 'menu' : undefined}
                      aria-expanded={children ? menuOpen === href : undefined}
                      onClick={children ? (e) => {
                        // No hover on a touch screen: the first tap opens the
                        // menu instead of navigating; a second tap closes it.
                        // (With a mouse, hover already shows it and a click
                        // goes to the page.)
                        if (window.matchMedia('(hover: none)').matches) {
                          e.preventDefault()
                          if (menuOpen === href) {
                            setMenuOpen(null)
                            e.currentTarget.blur()
                          } else {
                            setMenuOpen(href)
                          }
                        }
                      } : undefined}
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
                      {children && (
                        <Icon name="chevronDown" size={10} className={`transition-transform duration-150 group-focus-within:rotate-180 [@media(hover:hover)]:group-hover:rotate-180 ${menuOpen === href ? 'rotate-180' : ''}`} />
                      )}
                    </Link>
                    {children && (
                      // The top padding bridges the gap between the entry and
                      // the panel so the pointer never leaves the hover area.
                      <div className={`absolute left-0 top-full pt-2 ${menuOpen === href ? 'block' : 'hidden'} [@media(hover:hover)]:group-hover:block group-focus-within:block`} style={{ zIndex: 60 }}>
                        <ul
                          className="py-1.5"
                          style={{ minWidth: 220, border: '1px solid var(--border)', background: 'var(--bg)', boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}
                        >
                          {children.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                aria-current={pathname === child.href ? 'page' : undefined}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-[var(--surface-hover)]"
                                style={{ color: pathname === child.href ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font-poppins)', whiteSpace: 'nowrap' }}
                              >
                                <Icon name={child.icon} size={16} className="flex-shrink-0" style={{ color: pathname === child.href ? 'var(--accent)' : 'var(--text-subtle)' }} />
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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

            <ThemeToggle ariaLabel={t.themeToggle} />
          </div>

          {/* Right controls (mobile/tablet only — desktop has these inside the pill above) */}
          <div className="flex items-center gap-2 xl:hidden col-start-3 justify-self-end">
            <ThemeToggle ariaLabel={t.themeToggle} />

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
              aria-label={open ? t.closeMenu : t.openMenu}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="xl:hidden flex flex-col justify-center gap-1.5 w-11 h-11 rounded-lg transition-colors duration-200"
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
            aria-label={t.menuAria}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 xl:hidden flex flex-col"
            style={{ background: 'var(--bg)', paddingTop: '5rem' }}
          >
            {/* The menu is taller than a phone viewport (9 links + locale +
                theme rows) and body scroll is locked while it's open, so the
                list itself has to scroll or the bottom entries are simply
                unreachable — especially in landscape. */}
            <ul className="flex flex-col p-6 gap-1.5 flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              {links.map(({ href, label, icon, children }, i) => {
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
                        color: 'var(--text)',
                        background: isActive ? 'var(--surface-hover)' : 'transparent',
                        fontWeight: isActive ? 600 : undefined,
                        fontFamily: 'var(--font-space-grotesk)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                        style={{
                          background: isActive ? 'var(--accent)' : 'var(--surface)',
                          color: isActive ? 'var(--accent-contrast)' : 'var(--text-muted)',
                        }}
                      >
                        {icon}
                      </span>
                      <span className="flex-1">{label}</span>
                      {isActive && (
                        <m.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          style={{ color: 'var(--accent)', lineHeight: 0 }}
                        >
                          <Icon name="arrowRight" size={18} />
                        </m.span>
                      )}
                    </Link>
                    {children && (
                      <ul className="mt-1 mb-1 ml-12 flex flex-col gap-0.5">
                        {children.filter((c) => c.href !== href).map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              aria-current={pathname === child.href ? 'page' : undefined}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200"
                              style={{ color: pathname === child.href ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
                            >
                              <Icon name={child.icon} size={16} className="flex-shrink-0" style={{ color: pathname === child.href ? 'var(--accent)' : 'var(--text-subtle)' }} />
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
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
                  {t.switchTo}
                </Link>
              </m.li>
              <m.li
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (links.length + 1) * 0.04 + 0.05 }}
                className="flex items-center justify-between gap-3 px-4 py-3.5"
              >
                <span className="text-base font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-space-grotesk)' }}>
                  {t.themeToggle}
                </span>
                <ThemeToggle ariaLabel={t.themeToggle} />
              </m.li>
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
