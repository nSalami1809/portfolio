'use client'

// Hand-rolled SVG area sparkline — no charting library, same reasoning as
// BarChart: admin-only, tiny data volume, a gradient-filled line beats a
// new dependency.
interface AreaSparklineProps {
  data: { date: string; count: number }[]
  height?: number
  ariaLabel: string
}

export default function AreaSparkline({ data, height = 56, ariaLabel }: AreaSparklineProps) {
  const width = 100
  const max = Math.max(1, ...data.map((d) => d.count))
  const points = data.map((d, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * width : width / 2,
    y: height - (d.count / max) * (height - 6) - 3,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`
  const gradientId = 'admin-views-sparkline-fill'

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }} role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
