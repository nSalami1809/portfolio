'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { logout } from '@/actions/auth'

export interface SidebarNavItem {
  href: string
  label: string
  icon: string // SVG path `d` data — matches this app's existing hand-rolled icon convention
}

interface SidebarProps {
  items: SidebarNavItem[]
  mobileOpen: boolean
  onCloseMobile: () => void
}

const STORAGE_KEY = 'admin-sidebar-collapsed'
const WIDTH_OPEN = 256
const WIDTH_COLLAPSED = 64

// Collapse is a desktop-only affordance — on mobile the sidebar stays the
// existing full-width off-canvas overlay (opened via the topbar's hamburger),
// so a persisted "collapsed" preference from a previous desktop session must
// never shrink it on a phone. Defaults to true so the very first paint
// matches the current lg:sticky assumption; corrected on mount before the
// persisted preference is ever read.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches) // eslint-disable-line react-hooks/set-state-in-effect
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  )
}

function FadeLabel({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className={`whitespace-nowrap overflow-hidden ${className ?? ''}`}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function Tooltip({ show, label }: { show: boolean; label: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="tooltip"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap z-50 pointer-events-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Sidebar({ items, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname()
  const isDesktop = useIsDesktop()
  const [rawCollapsed, setRawCollapsed] = useState(false)
  const [hoveredHref, setHoveredHref] = useState<string | null>(null)
  const collapsed = isDesktop && rawCollapsed

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setRawCollapsed(true) // eslint-disable-line react-hooks/set-state-in-effect
    } catch { /* unavailable */ }
  }, [])

  const toggleCollapsed = () => {
    setRawCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* quota / unavailable */ }
      return next
    })
  }

  return (
    <motion.aside
      // Framer Motion only applies `animate` once it mounts client-side —
      // the initial `style.width` below is what the SSR/pre-hydration HTML
      // actually renders with, so it must match the default (open) state
      // to avoid a flash of unstyled/content-sized width on first paint.
      initial={false}
      animate={{ width: collapsed ? WIDTH_COLLAPSED : WIDTH_OPEN }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={`fixed lg:sticky top-0 h-screen flex-shrink-0 flex flex-col z-40 overflow-hidden transition-transform duration-300 lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ width: WIDTH_OPEN, background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      aria-label="Navigation admin"
    >
      {/* Logo */}
      <div className={`h-16 flex items-center flex-shrink-0 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`} style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="min-w-0">
          <FadeLabel show={!collapsed}>
            <p className="font-display font-bold text-base leading-tight" style={{ color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)' }}>Admin</span> Panel
            </p>
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
              Portfolio
              <Image src="/logo-black.png" alt="" width={11} height={11} className="dark:invert" style={{ width: 11, height: 11 }} />
            </p>
          </FadeLabel>
          {collapsed && (
            <Image src="/logo-black.png" alt="" width={20} height={20} className="dark:invert" style={{ width: 20, height: 20 }} />
          )}
        </div>
        <button
          onClick={onCloseMobile}
          aria-label="Fermer le menu"
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: 'var(--text-muted)', outlineColor: 'var(--accent)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto overflow-x-hidden space-y-0.5" role="navigation">
        {items.map(({ href, label, icon }) => {
          const isActive = pathname === href
          return (
            <div
              key={href}
              className="relative"
              onMouseEnter={() => setHoveredHref(href)}
              onMouseLeave={() => setHoveredHref(null)}
            >
              <Link
                href={href}
                onClick={onCloseMobile}
                aria-label={collapsed ? label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${collapsed ? 'justify-center' : ''}`}
                style={{
                  background: isActive ? 'var(--accent-glow)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-poppins)',
                  outlineColor: 'var(--accent)',
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                aria-current={isActive ? 'page' : undefined}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
                  <path d={icon}/>
                </svg>
                <FadeLabel show={!collapsed}>{label}</FadeLabel>
              </Link>
              <Tooltip show={collapsed && hoveredHref === href} label={label} />
            </div>
          )
        })}
      </nav>

      {/* Footer: collapse toggle (desktop) + back + logout */}
      <div className="p-3 flex-shrink-0 space-y-0.5" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={toggleCollapsed}
          aria-label={rawCollapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
          className={`hidden lg:flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 ${collapsed ? 'justify-center' : ''}`}
          style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)', outlineColor: 'var(--accent)' }}
        >
          <ChevronIcon direction={collapsed ? 'right' : 'left'} />
          <FadeLabel show={!collapsed}>Réduire</FadeLabel>
        </button>

        <div
          className="relative"
          onMouseEnter={() => setHoveredHref('__back')}
          onMouseLeave={() => setHoveredHref(null)}
        >
          <Link
            href="/"
            aria-label={collapsed ? 'Retour au portfolio' : undefined}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 ${collapsed ? 'justify-center' : ''}`}
            style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)', outlineColor: 'var(--accent)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            <FadeLabel show={!collapsed}>Retour au portfolio</FadeLabel>
          </Link>
          <Tooltip show={collapsed && hoveredHref === '__back'} label="Retour au portfolio" />
        </div>

        <div
          className="relative"
          onMouseEnter={() => setHoveredHref('__logout')}
          onMouseLeave={() => setHoveredHref(null)}
        >
          <form action={logout}>
            <button
              type="submit"
              aria-label={collapsed ? 'Se déconnecter' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 ${collapsed ? 'justify-center' : ''}`}
              style={{ color: '#EF4444', fontFamily: 'var(--font-poppins)', outlineColor: '#EF4444' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              <FadeLabel show={!collapsed}>Se déconnecter</FadeLabel>
            </button>
          </form>
          <Tooltip show={collapsed && hoveredHref === '__logout'} label="Se déconnecter" />
        </div>
      </div>
    </motion.aside>
  )
}
