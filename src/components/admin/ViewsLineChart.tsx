'use client'

import { useEffect, useRef, useState } from 'react'

interface Bucket { date: string; count: number }
type BucketSpan = 'hour' | 'day' | 'week' | 'month'

interface ViewsLineChartProps {
  data: Bucket[]
  bucketSpan: BucketSpan
  height?: number
}

// Rounds a max value up to a "nice" gridline top (4, 5, 10, 20, 25, 50, 100…)
// instead of the raw data max, so gridlines read like a real axis.
function niceMax(value: number): number {
  if (value <= 0) return 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const residual = value / magnitude
  const niceResidual = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1
  return niceResidual * magnitude
}

function formatBucketLabel(iso: string, span: BucketSpan): string {
  const d = new Date(iso)
  if (span === 'hour') return d.toLocaleTimeString('fr-FR', { hour: '2-digit' })
  if (span === 'month') return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const SPAN_ARIA: Record<BucketSpan, string> = { hour: 'heure', day: 'jour', week: 'semaine', month: 'mois' }

export default function ViewsLineChart({ data, bucketSpan, height = 200 }: ViewsLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const padding = { top: 14, right: 10, bottom: 22, left: 30 }
  const plotWidth = Math.max(0, width - padding.left - padding.right)
  const plotHeight = Math.max(0, height - padding.top - padding.bottom)

  const max = niceMax(Math.max(1, ...data.map((d) => d.count)))
  const gridSteps = 4
  const gridValues = Array.from({ length: gridSteps + 1 }, (_, i) => Math.round((max / gridSteps) * i))

  const points = data.map((d, i) => ({
    x: padding.left + (data.length > 1 ? (i / (data.length - 1)) * plotWidth : plotWidth / 2),
    y: padding.top + plotHeight - (d.count / max) * plotHeight,
    count: d.count,
    date: d.date,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const baseline = padding.top + plotHeight
  const areaPath = points.length ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z` : ''

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!points.length || plotWidth <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const idx = Math.round((relX / plotWidth) * (points.length - 1))
    setHoverIndex(Math.min(points.length - 1, Math.max(0, idx)))
  }

  // Thin out x-axis labels so they don't crowd on wide ranges (e.g. 30 daily buckets).
  const labelStep = Math.max(1, Math.ceil(points.length / 7))
  const hovered = hoverIndex !== null ? points[hoverIndex] : null

  const tooltipWidth = 118
  const tooltipX = hovered ? Math.min(Math.max(hovered.x - tooltipWidth / 2, 2), Math.max(2, width - tooltipWidth - 2)) : 0
  const tooltipY = hovered ? Math.max(2, hovered.y - 58) : 0

  return (
    <div ref={containerRef} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Évolution des vues par ${SPAN_ARIA[bucketSpan]}`}>
          <defs>
            <linearGradient id="views-line-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridValues.map((v, i) => {
            const y = padding.top + plotHeight - (i / gridSteps) * plotHeight
            return (
              <g key={i}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
                <text x={padding.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="var(--text-subtle)">{v}</text>
              </g>
            )
          })}

          {points.map((p, i) => (
            (i % labelStep === 0 || i === points.length - 1) && (
              <text key={p.date} x={p.x} y={height - 6} textAnchor="middle" fontSize="9" fill="var(--text-subtle)">
                {formatBucketLabel(p.date, bucketSpan)}
              </text>
            )
          ))}

          {areaPath && <path d={areaPath} fill="url(#views-line-fill)" stroke="none" />}
          {linePath && <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}

          {hovered && (
            <>
              <line x1={hovered.x} x2={hovered.x} y1={padding.top} y2={baseline} stroke="var(--text-subtle)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={hovered.x} cy={hovered.y} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
            </>
          )}

          <rect
            x={padding.left} y={padding.top} width={plotWidth} height={plotHeight}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
          />
        </svg>
      )}

      {hovered && (
        <div
          className="absolute rounded-lg px-3 py-2 pointer-events-none"
          style={{
            left: tooltipX, top: tooltipY, width: tooltipWidth,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}
        >
          <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>{formatBucketLabel(hovered.date, bucketSpan)}</p>
          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{hovered.count} vue{hovered.count !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}
