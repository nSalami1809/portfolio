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

// Most crawlers don't execute client-side JS at all, so this beacon
// already excludes the bulk of bot traffic by construction — this catches
// the ones that do (headless/JS-rendering crawlers, uptime monitors, link
// previewers) so the count stays a genuine visitor-activity signal.
const BOT_RE = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|headless|pingdom|lighthouse/i

// Fire-and-forget page-view counter for the admin dashboard's "Vues"
// stat — deliberately minimal (no cookies, no IP, no unique-visitor
// dedup) so it stays cheap and never becomes something to defend as PII.
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') ?? ''
    if (BOT_RE.test(ua)) return NextResponse.json({ ok: true })

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
