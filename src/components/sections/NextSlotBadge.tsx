import Link from 'next/link'
import { getUpcomingAvailability } from '@/actions/bookings'
import type { Locale } from '@/lib/i18n/locale'

interface Props {
  locale: Locale
  prefix: string
}

// Server component, deliberately kept out of HeroSection's own render path:
// the badge needs a bookings query, and the headline beside it — the page's
// LCP element — has no reason to wait for one. Rendered inside a Suspense
// boundary whose fallback reserves this exact height, so it can appear late
// without shifting anything.
export const NEXT_SLOT_BADGE_HEIGHT = 32

export default async function NextSlotBadge({ locale, prefix }: Props) {
  const upcoming = await getUpcomingAvailability(1).catch(() => [])
  const day = upcoming[0]
  const time = day?.slots[0]
  if (!day || !time) return null

  const label = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${day.date}T12:00:00`))

  return (
    <Link
      href={`/${locale}/calendrier`}
      className="inline-flex items-center gap-2 pl-2 pr-3 rounded-xl transition-colors duration-200 hover:border-[var(--accent)]"
      style={{ height: NEXT_SLOT_BADGE_HEIGHT, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
    >
      <span
        className="flex items-center justify-center w-4 h-4 rounded-md flex-shrink-0"
        style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
        aria-hidden="true"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </span>
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
        {prefix} <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{label} {time}</strong>
      </span>
    </Link>
  )
}
