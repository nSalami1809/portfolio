import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

let indexReady: Promise<void> | null = null
function ensureIndex() {
  if (!indexReady) {
    indexReady = getDb()
      .then((db) => db.collection('page_views').createIndex({ createdAt: 1 }, { expireAfterSeconds: 400 * 86_400 }))
      .then(() => {})
      .catch(() => {})
  }
  return indexReady
}

// Fire-and-forget page-view counter for the admin dashboard's "Vues"
// stat — deliberately minimal (no cookies, no IP, no unique-visitor
// dedup) so it stays cheap and never becomes something to defend as PII.
export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json()
    if (typeof path !== 'string' || !path || path.startsWith('/admin')) {
      return NextResponse.json({ ok: true })
    }
    await ensureIndex()
    const db = await getDb()
    await db.collection('page_views').insertOne({ path: path.slice(0, 200), createdAt: new Date() })
  } catch {
    // Never let a tracking hiccup surface to the visitor
  }
  return NextResponse.json({ ok: true })
}
