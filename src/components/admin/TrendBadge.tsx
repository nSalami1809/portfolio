export type Trend = { dir: 'up' | 'down' | 'new' | 'flat'; pct: number | null }

export function trend(current: number, previous: number): Trend {
  if (previous === 0) return { dir: current > 0 ? 'new' : 'flat', pct: null }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { dir: 'flat', pct: 0 }
  return { dir: pct > 0 ? 'up' : 'down', pct: Math.abs(pct) }
}

export default function TrendBadge({ t }: { t: Trend }) {
  if (t.dir === 'flat') return null
  const color = t.dir === 'down' ? '#EF4444' : '#10B981'
  const label = t.dir === 'new' ? 'Nouveau' : `${t.dir === 'up' ? '+' : '-'}${t.pct}%`
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ color, background: `${color}1A` }}
    >
      {t.dir === 'up' && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>}
      {t.dir === 'down' && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>}
      {label}
    </span>
  )
}
