import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getDb } from '@/lib/mongodb'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('admin-token')?.value
  if (!token) return false
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

function dayKey(d: Date) {
  // Africa/Libreville is a fixed UTC+1 offset — shift then read UTC fields
  const shifted = new Date(d.getTime() + 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const db = await getDb()
  const now = new Date()
  const since24h = new Date(now.getTime() - 86_400_000)
  const since14d = new Date(now.getTime() - 14 * 86_400_000)
  const since30d = new Date(now.getTime() - 30 * 86_400_000)
  const since60d = new Date(now.getTime() - 60 * 86_400_000)

  const [
    contacts30d, quotes30d, bookings30d, views30d, views24h,
    contactsPrev30d, quotesPrev30d, bookingsPrev30d, viewsPrev30d,
    upcomingBookings, acceptedQuotes, declinedQuotes,
    viewsRaw,
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
    db.collection('page_views')
      .find({ createdAt: { $gte: since14d } })
      .project<{ createdAt: Date }>({ createdAt: 1 })
      .toArray(),
  ])

  // Fill in every day of the 14-day window (including zero-view days) so
  // the chart has a continuous axis instead of gaps where nothing happened.
  const byDay = new Map<string, number>()
  for (const v of viewsRaw) byDay.set(dayKey(v.createdAt), (byDay.get(dayKey(v.createdAt)) ?? 0) + 1)
  const viewsByDay: { date: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = dayKey(new Date(now.getTime() - i * 86_400_000))
    viewsByDay.push({ date: d, count: byDay.get(d) ?? 0 })
  }

  const decidedQuotes = acceptedQuotes + declinedQuotes
  const quoteAcceptanceRate = decidedQuotes > 0 ? Math.round((acceptedQuotes / decidedQuotes) * 100) : null

  return NextResponse.json({
    contacts30d, quotes30d, bookings30d, views30d, views24h,
    contactsPrev30d, quotesPrev30d, bookingsPrev30d, viewsPrev30d,
    upcomingBookings, acceptedQuotes, quoteAcceptanceRate,
    viewsByDay,
  })
}
