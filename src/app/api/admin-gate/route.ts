import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

const MAX_ATTEMPTS = 5
const WINDOW_S = 15 * 60 // 15 minutes

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
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  await ensureIndex()
  const db = await getDb()
  const since = new Date(Date.now() - WINDOW_S * 1000)
  const attempts = await db.collection('admin_gate_rl').countDocuments({ ip, createdAt: { $gte: since } })

  if (attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, { status: 429 })
  }

  const { code } = await req.json().catch(() => ({ code: '' }))

  if (!code || code !== process.env.ADMIN_ACCESS_TOKEN) {
    await db.collection('admin_gate_rl').insertOne({ ip, createdAt: new Date() })
    return NextResponse.json({ error: 'Code invalide.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin-pre', '1', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
