import Link from 'next/link'
import { getUpcomingAvailability } from '@/actions/bookings'
import type { Locale } from '@/lib/i18n/locale'
import Icon from '@/components/ui/Icon'

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
        <Icon name="calendar" size={9} />
      </span>
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
        {prefix} <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{label} {time}</strong>
      </span>
    </Link>
  )
}
