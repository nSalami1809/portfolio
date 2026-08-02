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

// Full, uncapped backup of every collection — unlike the admin list pages
// (which cap at 200 docs for display), an export must never silently
// truncate data the user is relying on as a safety net.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const db = await getDb()
  const [portfolio, quotes, contacts, bookings, waitlist] = await Promise.all([
    db.collection('portfolio').findOne({ _id: 'main' as unknown as never }),
    db.collection('quotes').find({}).sort({ createdAt: -1 }).toArray(),
    db.collection('contacts').find({}).sort({ createdAt: -1 }).toArray(),
    db.collection('bookings').find({}).sort({ createdAt: -1 }).toArray(),
    db.collection('waitlist').find({}).sort({ createdAt: -1 }).toArray(),
  ])

  const body = JSON.stringify({
    exportedAt: new Date().toISOString(),
    portfolio,
    quotes,
    contacts,
    bookings,
    waitlist,
  }, null, 2)

  const filename = `portfolio-export-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
