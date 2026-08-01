'use client'

import { useMemo } from 'react'

export type DayStatus = 'available' | 'blocked' | 'booked'

interface MonthGridProps {
  year: number
  month: number // 1-12
  onNavigate: (year: number, month: number) => void
  selected?: string | null // 'YYYY-MM-DD'
  onSelectDate?: (dateISO: string) => void
  dayStatus?: Record<string, DayStatus>
  headerAction?: React.ReactNode
  locale?: 'fr' | 'en'
  todayISO: string
  disablePast?: boolean
}

const DOT_COLOR: Record<DayStatus, string> = {
  available: 'var(--accent)',
  booked: '#F59E0B',
  blocked: 'var(--text-subtle)',
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Pure Date math — no calendar library. A 7-column grid over 42 cells
// (6 weeks) covers every month layout without per-row branching.
function buildCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  const startOffset = first.getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()

  const cells: { date: Date; iso: string; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startOffset + 1
    let date: Date
    let inMonth = true
    if (dayNum < 1) {
      date = new Date(year, month - 2, daysInPrevMonth + dayNum)
      inMonth = false
    } else if (dayNum > daysInMonth) {
      date = new Date(year, month, dayNum - daysInMonth)
      inMonth = false
    } else {
      date = new Date(year, month - 1, dayNum)
    }
    cells.push({ date, iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, inMonth })
  }
  return cells
}

export default function MonthGrid({
  year, month, onNavigate, selected, onSelectDate, dayStatus, headerAction, locale = 'fr', todayISO, disablePast,
}: MonthGridProps) {
  const cells = useMemo(() => buildCells(year, month), [year, month])
  const intlLocale = locale === 'en' ? 'en-US' : 'fr-FR'

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)),
    [year, month, intlLocale],
  )
  const rangeLabel = useMemo(() => {
    const first = new Date(year, month - 1, 1)
    const last = new Date(year, month, 0)
    const fmt = new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric', year: 'numeric' })
    return `${fmt.format(first)} – ${fmt.format(last)}`
  }, [year, month, intlLocale])
  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: 'short' })
    // 2023-01-01 was a Sunday — a stable anchor to enumerate Sun..Sat
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)))
  }, [intlLocale])

  const goPrev = () => onNavigate(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)
  const goNext = () => onNavigate(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)
  const goToday = () => {
    const now = new Date()
    onNavigate(now.getFullYear(), now.getMonth() + 1)
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div
          className="hidden sm:flex flex-col items-center justify-center rounded-xl overflow-hidden flex-shrink-0"
          style={{ width: 52, border: '1px solid var(--border)' }}
          aria-hidden="true"
        >
          <div className="w-full text-center text-[10px] font-bold uppercase py-1" style={{ background: 'var(--bg-secondary)', color: 'var(--text-subtle)', letterSpacing: '0.06em' }}>
            {new Intl.DateTimeFormat(intlLocale, { month: 'short' }).format(new Date())}
          </div>
          <div className="w-full text-center text-lg font-display font-bold py-1" style={{ color: 'var(--text)' }}>
            {new Date().getDate()}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold text-xl capitalize truncate" style={{ color: 'var(--text)' }}>{monthLabel}</h2>
          <p className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{rangeLabel}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          <button
            onClick={goPrev}
            aria-label={locale === 'en' ? 'Previous month' : 'Mois précédent'}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            onClick={goToday}
            className="px-3 h-8 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'var(--font-poppins)' }}
          >
            {locale === 'en' ? 'Today' : "Aujourd'hui"}
          </button>
          <button
            onClick={goNext}
            aria-label={locale === 'en' ? 'Next month' : 'Mois suivant'}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {headerAction}
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border)' }}>
        {weekdayLabels.map((label) => (
          <div key={label} className="py-2.5 text-center text-xs font-semibold capitalize" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map(({ date, iso, inMonth }, i) => {
          const isToday = iso === todayISO
          const isSelected = iso === selected
          const isPast = disablePast && iso < todayISO
          const status = dayStatus?.[iso]
          const clickable = inMonth && !isPast && !!onSelectDate

          return (
            <button
              key={iso + i}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelectDate?.(iso)}
              className="relative flex flex-col items-start p-2 sm:p-2.5 text-left transition-colors"
              style={{
                minHeight: 64,
                background: isSelected ? 'var(--accent-glow)' : 'transparent',
                borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                borderBottom: i < 35 ? '1px solid var(--border)' : 'none',
                opacity: inMonth ? 1 : 0.35,
                cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <span
                className="flex items-center justify-center rounded-full text-xs font-medium"
                style={{
                  width: 22, height: 22,
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? 'var(--accent-contrast)' : isPast ? 'var(--text-subtle)' : 'var(--text)',
                }}
              >
                {date.getDate()}
              </span>
              {status && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 right-2 rounded-full"
                  style={{ width: 6, height: 6, background: DOT_COLOR[status] }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
