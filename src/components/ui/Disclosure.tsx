'use client'

import { useId, useState, type ReactNode } from 'react'

interface Props {
  title: string
  // Shown under the title while closed: tells the visitor what is inside.
  subtitle?: string
  // A small pill on the right ("Optional", "3 / 7"…).
  badge?: string
  // Illustration in the accent-tinted tile on the left; a number works too.
  icon?: ReactNode
  index?: number
  defaultOpen?: boolean
  // 'prominent' = a call to action (form section); 'quiet' = a list row (FAQ).
  variant?: 'prominent' | 'quiet'
  children: ReactNode
}

// An expandable panel that *looks* expandable: an illustrated tile, a subtitle
// that says what is inside, a +/− control that turns, an accent bar and a soft
// glow when open, and a smooth height animation. The content stays in the DOM
// while closed (hidden from assistive tech with `inert`), so search engines
// and the FAQ structured data still see every answer.
export default function Disclosure({ title, subtitle, badge, icon, index, defaultOpen = false, variant = 'quiet', children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const uid = useId()
  const prominent = variant === 'prominent'

  return (
    <div className={`disclosure ${prominent ? 'disclosure-prominent' : ''}`} data-open={open}>
      <button
        type="button"
        id={`${uid}-button`}
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        onClick={() => setOpen((v) => !v)}
        className="disclosure-trigger"
      >
        <span className="disclosure-tile" aria-hidden="true">
          {icon ?? (index !== undefined ? <span className="font-display font-bold text-sm">{String(index).padStart(2, '0')}</span> : null)}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block font-display font-semibold" style={{ color: 'var(--text)', fontSize: prominent ? '1rem' : '0.98rem', lineHeight: 1.35 }}>{title}</span>
          {subtitle && !open && <span className="block text-xs mt-1" style={{ color: 'var(--text-subtle)', lineHeight: 1.5 }}>{subtitle}</span>}
        </span>
        {badge && <span className="disclosure-badge">{badge}</span>}
        <span className="disclosure-toggle" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <line className="disclosure-plus" x1="12" y1="5" x2="12" y2="19" />
          </svg>
        </span>
      </button>
      <div className="disclosure-body" id={`${uid}-panel`} role="region" aria-labelledby={`${uid}-button`} inert={!open}>
        <div>
          <div className="disclosure-content">{children}</div>
        </div>
      </div>
    </div>
  )
}
