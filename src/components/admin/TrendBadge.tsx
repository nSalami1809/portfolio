import Icon from '@/components/ui/Icon'
export type Trend = { dir: 'up' | 'down' | 'new' | 'flat'; pct: number | null }

export function trend(current: number, previous: number): Trend {
  if (previous === 0) return { dir: current > 0 ? 'new' : 'flat', pct: null }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { dir: 'flat', pct: 0 }
  return { dir: pct > 0 ? 'up' : 'down', pct: Math.abs(pct) }
}

export default function TrendBadge({ t }: { t: Trend }) {
  if (t.dir === 'flat') return null
  const color = t.dir === 'down' ? '#D90000' : '#008000'
  const label = t.dir === 'new' ? 'Nouveau' : `${t.dir === 'up' ? '+' : '-'}${t.pct}%`
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ color, background: `${color}1A` }}
    >
      {t.dir === 'up' && <Icon name="chevronUp" size={8} />}
      {t.dir === 'down' && <Icon name="chevronDown" size={8} />}
      {label}
    </span>
  )
}
