import { getDb } from '@/lib/mongodb'
import { RANGE_DAYS, RANGE_LABELS, type StatsRange, type OverviewStats, type ViewsStats, type ViewsBucket } from '@/lib/admin-stats'

// ── Overview (fixed 30j vs 30j précédents) — the "Aperçu" pills ────────────

export async function getOverviewStats(): Promise<OverviewStats> {
  const db = await getDb()
  const now = new Date()
  const since24h = new Date(now.getTime() - 86_400_000)
  const since30d = new Date(now.getTime() - 30 * 86_400_000)
  const since60d = new Date(now.getTime() - 60 * 86_400_000)

  const [
    contacts30d, quotes30d, bookings30d, views30d, views24h,
    contactsPrev30d, quotesPrev30d, bookingsPrev30d, viewsPrev30d,
    upcomingBookings, acceptedQuotes, declinedQuotes,
  ] = await Promise.all([
    db.collection('contacts').countDocuments({ createdAt: { $gte: since30d } }),
    db.collection('quotes').countDocuments({ createdAt: { $gte: since30d } }),
    db.collection('bookings').countDocuments({ createdAt: { $gte: since30d }, source: { $ne: 'admin' } }),
    db.collection('page_views').countDocuments({ createdAt: { $gte: since30d } }),
    db.collection('page_views').countDocuments({ createdAt: { $gte: since24h } }),
    db.collection('contacts').countDocuments({ createdAt: { $gte: since60d, $lt: since30d } }),
    db.collection('quotes').countDocuments({ createdAt: { $gte: since60d, $lt: since30d } }),
    db.collection('bookings').countDocuments({ createdAt: { $gte: since60d, $lt: since30d }, source: { $ne: 'admin' } }),
    db.collection('page_views').countDocuments({ createdAt: { $gte: since60d, $lt: since30d } }),
    db.collection('bookings').countDocuments({ status: 'confirmed', start: { $gte: now } }),
    db.collection('quotes').countDocuments({ status: 'accepted' }),
    db.collection('quotes').countDocuments({ status: 'declined' }),
  ])

  const decidedQuotes = acceptedQuotes + declinedQuotes
  const quoteAcceptanceRate = decidedQuotes > 0 ? Math.round((acceptedQuotes / decidedQuotes) * 100) : null

  return {
    contacts30d, quotes30d, bookings30d, views30d, views24h,
    contactsPrev30d, quotesPrev30d, bookingsPrev30d, viewsPrev30d,
    upcomingBookings, acceptedQuotes, quoteAcceptanceRate,
  }
}

// ── Views widget — selectable range + archive browsing ─────────────────────

// Chart granularity scales with the window so a 1-year view doesn't render
// 365 individual points — bucket count stays readable regardless of range.
function bucketSpanFor(days: number): { span: ViewsStats['bucketSpan']; ms: number } {
  if (days <= 1) return { span: 'hour', ms: 3_600_000 }
  if (days <= 30) return { span: 'day', ms: 86_400_000 }
  if (days <= 120) return { span: 'week', ms: 7 * 86_400_000 }
  return { span: 'month', ms: 30 * 86_400_000 }
}

export async function getViewsStats(range: StatsRange, offset: number): Promise<ViewsStats> {
  const db = await getDb()
  const days = RANGE_DAYS[range]
  const windowMs = days * 86_400_000
  const now = new Date()
  const end = new Date(now.getTime() - offset * windowMs)
  const start = new Date(end.getTime() - windowMs)
  const prevStart = new Date(start.getTime() - windowMs)

  const [viewsRaw, viewsPrev] = await Promise.all([
    db.collection('page_views')
      .find({ createdAt: { $gte: start, $lt: end } })
      .project<{ createdAt: Date }>({ createdAt: 1 })
      .toArray(),
    db.collection('page_views').countDocuments({ createdAt: { $gte: prevStart, $lt: start } }),
  ])

  const { span, ms: bucketMs } = bucketSpanFor(days)
  const numBuckets = Math.ceil(windowMs / bucketMs)
  const buckets: ViewsBucket[] = []
  for (let i = 0; i < numBuckets; i++) {
    const bucketStart = new Date(start.getTime() + i * bucketMs)
    const bucketEnd = new Date(bucketStart.getTime() + bucketMs)
    let count = 0
    for (const v of viewsRaw) if (v.createdAt >= bucketStart && v.createdAt < bucketEnd) count++
    buckets.push({ date: bucketStart.toISOString(), count })
  }

  return {
    range, offset, rangeLabel: RANGE_LABELS[range],
    periodStart: start.toISOString(), periodEnd: end.toISOString(),
    bucketSpan: span,
    views: viewsRaw.length, viewsPrev,
    canGoNext: offset > 0,
    buckets,
  }
}
