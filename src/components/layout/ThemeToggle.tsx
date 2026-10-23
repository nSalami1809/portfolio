'use client'

import { m } from 'framer-motion'
import { useTheme } from '@/hooks/useTheme'
import Icon from '@/components/ui/Icon'

function MoonIcon() {
  return (
    <Icon name="moon" size={13} />
  )
}

function SunIcon() {
  return (
    <Icon name="sun" size={13} />
  )
}

export default function ThemeToggle({ label, ariaLabel }: { label?: string; ariaLabel: string }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    // The switch itself stays 52×28 for looks; the button around it is
    // transparently padded out to a 44px-tall finger target.
    <button
      onClick={toggle}
      role="switch"
      aria-checked={!isDark}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center flex-shrink-0 py-2"
    >
      <span
        className="relative inline-flex items-center transition-colors duration-300"
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
        <m.span
          aria-hidden="true"
          className="absolute top-0.5 flex items-center justify-center"
          style={{ width: 22, height: 22, background: 'var(--accent)', color: 'var(--accent-contrast)' }}
          animate={{ left: isDark ? 2 : 26 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        >
          {isDark ? <MoonIcon /> : <SunIcon />}
        </m.span>
      </span>
      {label && <span className="sr-only">{label}</span>}
    </button>
  )
}
