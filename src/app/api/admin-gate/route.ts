import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { clientIpFromHeaders } from '@/lib/client-ip'

const MAX_ATTEMPTS = 5
const WINDOW_S = 15 * 60 // 15 minutes

// Hash both sides to a fixed-length digest before comparing: timingSafeEqual
// throws on mismatched buffer lengths, which itself leaks the token's length
// if done directly on the raw strings.
function safeCodeEquals(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

let indexReady: Promise<void> | null = null
function ensureIndex() {
  if (!indexReady) {
    indexReady = getDb()
      .then((db) => db.collection('admin_gate_rl').createIndex({ createdAt: 1 }, { expireAfterSeconds: WINDOW_S }))
      .then(() => {})
      .catch(() => {})
  }
  return indexReady
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers)

  await ensureIndex()
  const db = await getDb()
  const since = new Date(Date.now() - WINDOW_S * 1000)
  const attempts = await db.collection('admin_gate_rl').countDocuments({ ip, createdAt: { $gte: since } })

  if (attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, { status: 429 })
  }

  const { code } = await req.json().catch(() => ({ code: '' }))
  const adminToken = process.env.ADMIN_ACCESS_TOKEN

  if (!code || typeof code !== 'string' || !adminToken || !safeCodeEquals(code, adminToken)) {
    await db.collection('admin_gate_rl').insertOne({ ip, createdAt: new Date() })
    return NextResponse.json({ error: 'Code invalide.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin-pre', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
