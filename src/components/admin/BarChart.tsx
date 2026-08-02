'use client'

// Hand-rolled SVG bar chart — no charting library. This only ever renders
// inside /admin (never shipped to the public bundle), and the data volume
// is tiny (14 points), so a few dozen lines of SVG beats a new dependency.
interface BarChartProps {
  data: { date: string; count: number }[]
  height?: number
}

export default function BarChart({ data, height = 120 }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const barWidth = 100 / data.length

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }} role="img" aria-label="Vues par jour sur les 14 derniers jours">
        {data.map((d, i) => {
          const barHeight = (d.count / max) * (height - 4)
          const label = new Date(`${d.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          return (
            <rect
              key={d.date}
              x={i * barWidth + barWidth * 0.15}
              y={height - barHeight}
              width={barWidth * 0.7}
              height={Math.max(barHeight, d.count > 0 ? 1.5 : 0)}
              rx={1}
              fill="var(--accent)"
              opacity={d.count > 0 ? 0.9 : 0.15}
            >
              <title>{`${label} : ${d.count} vue${d.count !== 1 ? 's' : ''}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          {new Date(`${data[0].date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          {new Date(`${data[data.length - 1].date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  )
}
