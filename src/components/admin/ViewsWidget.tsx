'use client'

import { useEffect, useRef, useState } from 'react'
import AreaSparkline from './AreaSparkline'
import TrendBadge, { trend } from './TrendBadge'
import { STATS_RANGES, RANGE_LABELS } from '@/lib/admin-stats'
import type { StatsRange, ViewsStats } from '@/lib/admin-stats'

const SPAN_LABEL: Record<ViewsStats['bucketSpan'], string> = {
  hour: 'heure', day: 'jour', week: 'semaine', month: 'mois',
}

function formatPeriod(stats: ViewsStats): string {
  if (stats.offset === 0) return `${stats.rangeLabel} — jusqu'à aujourd'hui`
  const opts: Intl.DateTimeFormatOptions = stats.bucketSpan === 'hour'
    ? { day: 'numeric', month: 'short', hour: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' }
  const start = new Date(stats.periodStart).toLocaleDateString('fr-FR', opts)
  const end = new Date(stats.periodEnd).toLocaleDateString('fr-FR', opts)
  return `${start} – ${end}`
}

export default function ViewsWidget({ initial }: { initial: ViewsStats }) {
  const [stats, setStats] = useState(initial)
  const [range, setRange] = useState<StatsRange>(initial.range)
  const [offset, setOffset] = useState(initial.offset)
  const [loading, setLoading] = useState(false)
  const mounted = useRef(false)
  const requestId = useRef(0)

  useEffect(() => {
    // Skip the very first run — the server already rendered this exact state.
    if (!mounted.current) { mounted.current = true; return }

    const id = ++requestId.current
    setLoading(true)
    fetch(`/api/admin-stats/views?range=${range}&offset=${offset}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ViewsStats | null) => { if (json && id === requestId.current) setStats(json) })
      .catch(() => {})
      .finally(() => { if (id === requestId.current) setLoading(false) })
  }, [range, offset])

  const t = trend(stats.views, stats.viewsPrev)

  return (
    <div className="card no-lift p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>Vues du site</p>

        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => { setRange(e.target.value as StatsRange); setOffset(0) }}
            aria-label="Période affichée"
            className="input text-xs"
            style={{ padding: '0.35rem 0.6rem', width: 'auto' }}
          >
            {STATS_RANGES.map((r) => <option key={r} value={r}>{RANGE_LABELS[r]}</option>)}
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              aria-label="Période précédente"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - 1))}
              disabled={offset === 0}
              aria-label="Période suivante"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:pointer-events-none"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{formatPeriod(stats)}</p>
        <TrendBadge t={t} />
      </div>

      <div className="flex items-end gap-4" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
        <p className="text-4xl font-display font-bold flex-shrink-0 leading-none" style={{ color: 'var(--text)' }}>{stats.views}</p>
        <div className="flex-1 min-w-0">
          <AreaSparkline data={stats.buckets} height={56} ariaLabel={`Vues par ${SPAN_LABEL[stats.bucketSpan]}`} />
        </div>
      </div>
    </div>
  )
}
