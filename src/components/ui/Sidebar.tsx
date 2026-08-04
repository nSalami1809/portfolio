'use client'

import Link from 'next/link'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// A tablet in landscape (e.g. iPad) can be wide enough to hit the `lg:`
// desktop breakpoint while still being touch-only — `mouseenter`/`mouseleave`
// never fire there, so a hover-only rail would be permanently stuck
// collapsed with no way to see labels. Detect a real pointer + hover
// capability and fall back to tap-to-toggle otherwise.
function useHasHover() {
  const [hasHover, setHasHover] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    setHasHover(mq.matches) // eslint-disable-line react-hooks/set-state-in-effect
    const onChange = () => setHasHover(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return hasHover
}

export interface SidebarLinkData {
  label: string
  href: string
  icon: React.ReactNode
}

interface SidebarContextProps {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  animate: boolean
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined)

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) throw new Error('useSidebar must be used within a <Sidebar>')
  return context
}

// `open`/`setOpen` can be left uncontrolled (internal state) or lifted by the
// caller — the admin layout lifts it so its own topbar hamburger can drive
// the same mobile panel this renders.
export function Sidebar({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  animate?: boolean
}) {
  const [openState, setOpenState] = useState(false)
  const open = openProp !== undefined ? openProp : openState
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState
  return <SidebarContext.Provider value={{ open, setOpen, animate }}>{children}</SidebarContext.Provider>
}

// Desktop rail: collapsed by default, opens on hover or keyboard focus.
export function DesktopSidebar({
  className,
  style,
  children,
  width = 256,
  collapsedWidth = 64,
}: {
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
  width?: number
  collapsedWidth?: number
}) {
  const { open, setOpen, animate } = useSidebar()
  const hasHover = useHasHover()
  return (
    <motion.aside
      // Framer Motion's `animate` prop only takes effect once it mounts
      // client-side — `style.width` below is what SSR actually renders,
      // so it must match the resting (collapsed) state to avoid a flash
      // of content-sized width on first paint.
      initial={false}
      animate={{ width: animate ? (open ? width : collapsedWidth) : width }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      onMouseEnter={hasHover ? () => setOpen(true) : undefined}
      onMouseLeave={hasHover ? () => setOpen(false) : undefined}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false) }}
      onClick={!hasHover ? () => setOpen((v) => !v) : undefined}
      className={cn('h-full hidden lg:flex lg:flex-col flex-shrink-0 overflow-hidden', className)}
      style={{ width: collapsedWidth, ...style }}
      aria-label="Navigation admin"
    >
      {children}
    </motion.aside>
  )
}

// Mobile: full-screen slide-in panel. No built-in trigger button — the
// caller wires its own hamburger to the shared open/setOpen state, so
// there's exactly one mobile toggle in the layout, not two.
export function MobileSidebarPanel({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const { open, setOpen } = useSidebar()
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] lg:hidden"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setOpen(false)}
            role="presentation"
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={cn('fixed left-0 top-0 h-full w-64 z-[100] flex flex-col lg:hidden', className)}
            style={style}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function SidebarLink({
  link,
  isActive,
  onNavigate,
  className,
}: {
  link: SidebarLinkData
  isActive?: boolean
  onNavigate?: () => void
  className?: string
}) {
  const { open } = useSidebar()
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      aria-label={!open ? link.label : undefined}
      className={cn(
        'flex items-center gap-3 group/sidebar px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2',
        !open && 'justify-center',
        className,
      )}
      style={{
        background: isActive ? 'var(--accent-glow)' : 'transparent',
        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
        fontFamily: 'var(--font-poppins)',
        outlineColor: 'var(--accent)',
      }}
      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }}
      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <span className="flex-shrink-0">{link.icon}</span>
      <AnimatePresence initial={false}>
        {open && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="whitespace-nowrap overflow-hidden group-hover/sidebar:translate-x-1 transition-transform duration-150"
          >
            {link.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )
}
