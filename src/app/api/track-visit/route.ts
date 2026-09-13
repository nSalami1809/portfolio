import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { clientIpFromHeaders } from '@/lib/client-ip'

// Lightweight per-instance throttle — deliberately in-memory (no DB round
// trip, so this beacon never adds latency to page navigation) rather than a
// distributed limiter. It resets on cold start and isn't shared across
// instances, so it's not a hard cap, but it's enough to stop a single
// scripted client from flooding `page_views` with inserts.
const MAX_PER_MINUTE = 120
const hits = new Map<string, { count: number; windowStart: number }>()
function isThrottled(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now - entry.windowStart > 60_000) {
    hits.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count++
  return entry.count > MAX_PER_MINUTE
}

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

    const ip = clientIpFromHeaders(req.headers)
    if (isThrottled(ip)) return NextResponse.json({ ok: true })

    const { path } = await req.json()
    if (typeof path !== 'string' || !path || path.startsWith('/admin')) {
      return NextResponse.json({ ok: true })
    }
    const safePath = path.slice(0, 200)
    after(async () => {
      try {
        await ensureIndex()
        const db = await getDb()
        await db.collection('page_views').insertOne({ path: safePath, createdAt: new Date() })
      } catch {
        // Never let a tracking hiccup surface to the visitor
      }
    })
  } catch {
    // Never let a tracking hiccup surface to the visitor
  }
  return NextResponse.json({ ok: true })
}
