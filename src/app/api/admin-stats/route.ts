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

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const db = await getDb()
  const since30d = new Date(Date.now() - 30 * 86_400_000)
  const since24h = new Date(Date.now() - 86_400_000)
  const now = new Date()

  const [contacts30d, quotes30d, bookings30d, acceptedQuotes, upcomingBookings, views30d, views24h] = await Promise.all([
    db.collection('contacts').countDocuments({ createdAt: { $gte: since30d } }),
    db.collection('quotes').countDocuments({ createdAt: { $gte: since30d } }),
    db.collection('bookings').countDocuments({ createdAt: { $gte: since30d }, source: { $ne: 'admin' } }),
    db.collection('quotes').countDocuments({ status: 'accepted' }),
    db.collection('bookings').countDocuments({ status: 'confirmed', start: { $gte: now } }),
    db.collection('page_views').countDocuments({ createdAt: { $gte: since30d } }),
    db.collection('page_views').countDocuments({ createdAt: { $gte: since24h } }),
  ])

  return NextResponse.json({ contacts30d, quotes30d, bookings30d, acceptedQuotes, upcomingBookings, views30d, views24h })
}
