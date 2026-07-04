'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const links = [
  {
    href: '/',
    label: 'À propos',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    href: '/resume',
    label: 'Expérience',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
  },
  {
    href: '/vision',
    label: 'Vision',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    href: '/projects',
    label: 'Projets',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="2" x2="12" y2="22"/>
      </svg>
    ),
  },
  {
    href: '/blog',
    label: 'Blog',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  {
    href: '/contact',
    label: 'Contact',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
      </svg>
    ),
  },
]

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

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
        <nav aria-label="Navigation principale" className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="font-display font-bold text-xl tracking-tight transition-colors duration-200"
            style={{ color: 'var(--text)' }}
          >
            <span style={{ color: 'var(--accent)' }}>N</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span>S</span>
          </Link>

          {/* Desktop nav */}
          <ul
            className="hidden lg:flex items-center gap-0.5"
            onMouseLeave={() => setHovered(null)}
          >
            {links.map(({ href, label, icon }) => {
              const isActive = pathname === href
              const isHovered = hovered === href
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onMouseEnter={() => setHovered(href)}
                    aria-current={isActive ? 'page' : undefined}
                    className="relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150"
                    style={{
                      color: isActive ? 'var(--accent)' : isHovered ? 'var(--text)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-poppins)',
                      position: 'relative',
                    }}
                  >
                    {/* Hover background pill */}
                    {isHovered && !isActive && (
                      <motion.span
                        layoutId="nav-hover-pill"
                        className="absolute inset-0 rounded-lg -z-10"
                        style={{ background: 'var(--surface-hover)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    {/* Active background pill */}
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-lg -z-10"
                        style={{ background: 'var(--accent-glow)' }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="transition-colors duration-150"
                      style={{ color: isActive ? 'var(--accent)' : isHovered ? 'var(--accent)' : 'var(--text-subtle)' }}
                    >
                      {icon}
                    </span>
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Hamburger */}
            <button
              onClick={() => setOpen(!open)}
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="lg:hidden flex flex-col justify-center gap-1.5 w-9 h-9 rounded-lg transition-colors duration-200"
              style={{ background: open ? 'var(--surface-hover)' : 'transparent' }}
            >
              <motion.span
                animate={open ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
                className="block w-5 h-0.5 mx-auto origin-center"
                style={{ background: 'var(--text)' }}
              />
              <motion.span
                animate={open ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                className="block w-5 h-0.5 mx-auto"
                style={{ background: 'var(--text)' }}
              />
              <motion.span
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
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-label="Menu de navigation"
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
                  <motion.li
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
                          background: isActive ? 'rgba(139,92,246,0.15)' : 'var(--surface)',
                          color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {icon}
                      </span>
                      <span className="flex-1">{label}</span>
                      {isActive && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          style={{ color: 'var(--accent)', fontSize: '18px', lineHeight: 1 }}
                        >
                          →
                        </motion.span>
                      )}
                    </Link>
                  </motion.li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
