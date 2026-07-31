'use client'

import { motion } from 'framer-motion'
import { useTheme } from '@/hooks/useTheme'

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

export default function ThemeToggle({ label, ariaLabel }: { label?: string; ariaLabel: string }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={!isDark}
      aria-label={ariaLabel}
      className="relative inline-flex items-center flex-shrink-0 rounded-full transition-colors duration-300"
      style={{ width: 52, height: 28, background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <span className="absolute inset-0 flex items-center justify-between px-1.5" aria-hidden="true">
        <span style={{ color: isDark ? 'var(--text)' : 'var(--text-subtle)' }}>
          <MoonIcon />
        </span>
        <span style={{ color: isDark ? 'var(--text-subtle)' : 'var(--text)' }}>
          <SunIcon />
        </span>
      </span>
      <motion.span
        aria-hidden="true"
        className="absolute top-0.5 rounded-full flex items-center justify-center"
        style={{ width: 22, height: 22, background: 'var(--accent)', color: 'var(--accent-contrast)' }}
        animate={{ left: isDark ? 2 : 26 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </motion.span>
      {label && <span className="sr-only">{label}</span>}
    </button>
  )
}
