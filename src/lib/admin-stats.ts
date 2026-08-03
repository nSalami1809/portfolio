// Types and constants shared between server-side stat queries
// (src/lib/admin-stats-data.ts) and the client dashboard components. Kept
// free of any server-only import (e.g. mongodb) so client components can
// safely pull in the range constants without dragging the DB driver into
// the browser bundle.

export interface OverviewStats {
  contacts30d: number
  quotes30d: number
  bookings30d: number
  views30d: number
  views24h: number
  contactsPrev30d: number
  quotesPrev30d: number
  bookingsPrev30d: number
  viewsPrev30d: number
  upcomingBookings: number
  acceptedQuotes: number
  quoteAcceptanceRate: number | null
}

export const STATS_RANGES = ['1d', '7d', '14d', '30d', '90d', '180d', '270d', '365d'] as const
export type StatsRange = (typeof STATS_RANGES)[number]

export const RANGE_DAYS: Record<StatsRange, number> = {
  '1d': 1, '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180, '270d': 270, '365d': 365,
}

export const RANGE_LABELS: Record<StatsRange, string> = {
  '1d': '1 jour', '7d': '1 semaine', '14d': '14 jours', '30d': '1 mois',
  '90d': '3 mois', '180d': '6 mois', '270d': '9 mois', '365d': '1 an',
}

export function isStatsRange(v: string): v is StatsRange {
  return (STATS_RANGES as readonly string[]).includes(v)
}

export interface ViewsBucket { date: string; count: number }

export interface ViewsStats {
  range: StatsRange
  offset: number
  rangeLabel: string
  periodStart: string
  periodEnd: string
  bucketSpan: 'hour' | 'day' | 'week' | 'month'
  views: number
  viewsPrev: number
  canGoNext: boolean
  buckets: ViewsBucket[]
}
