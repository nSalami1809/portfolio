'use server'

import { headers } from 'next/headers'
import type { WithId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { waitlistSlotOpenEmail } from '@/lib/email-templates'
import { requireAdmin } from '@/lib/require-admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
const MAX_PER_HOUR = 5

interface WaitlistRecord {
  date: string // 'YYYY-MM-DD', same Africa/Libreville-day convention as bookings
  name?: string
  email: string
  notified: boolean
  createdAt: Date
}

function waitlist() {
  return getDb().then((db) => db.collection<WaitlistRecord>('waitlist'))
}

let indexesReady: Promise<void> | null = null
function getIndexes() {
  if (!indexesReady) {
    indexesReady = getDb()
      .then((db) => db.collection('waitlist_ratelimits').createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }))
      .then(() => {})
      .catch(() => {})
  }
  return indexesReady
}

export async function joinWaitlist(payload: { date: string; email: string; name?: string }): Promise<{ ok: boolean; message: string }> {
  if (!payload.date) return { ok: false, message: 'Date requise.' }
  if (!EMAIL_RE.test(payload.email)) return { ok: false, message: 'Adresse email invalide.' }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? 'unknown'

  const [db] = await Promise.all([getDb(), getIndexes()])
  const since = new Date(Date.now() - 3600 * 1000)
  const count = await db.collection('waitlist_ratelimits').countDocuments({ ip, createdAt: { $gte: since } })
  if (count >= MAX_PER_HOUR) {
    return { ok: false, message: 'Limite atteinte. Réessayez plus tard.' }
  }

  const col = await waitlist()
  const existing = await col.findOne({ date: payload.date, email: payload.email.trim().toLowerCase() })
  if (existing) return { ok: true, message: 'Vous êtes déjà sur la liste pour ce jour.' }

  await db.collection('waitlist_ratelimits').insertOne({ ip, createdAt: new Date() })
  await col.insertOne({
    date: payload.date,
    name: payload.name?.trim() || undefined,
    email: payload.email.trim().toLowerCase(),
    notified: false,
    createdAt: new Date(),
  })

  return { ok: true, message: 'Vous serez prévenu par email si une place se libère.' }
}

// Called after a cancellation frees up a slot on `date` — best-effort, never
// throws (a notification hiccup must not break the cancellation itself).
export async function notifyWaitlist(date: string): Promise<void> {
  try {
    const col = await waitlist()
    const entries = await col.find({ date, notified: false }).toArray()
    if (entries.length === 0) return

    const transporter = getTransporter()
    for (const entry of entries as WithId<WaitlistRecord>[]) {
      try {
        const email = waitlistSlotOpenEmail({ date, name: entry.name })
        await transporter.sendMail({
          from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
          to: entry.email,
          subject: email.subject,
          html: email.html,
        })
        await col.updateOne({ _id: entry._id }, { $set: { notified: true } })
      } catch (e) {
        console.error('[notifyWaitlist] email error for', entry.email, e)
      }
    }
  } catch (e) {
    console.error('[notifyWaitlist] error:', e)
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────

export async function getWaitlistCounts(): Promise<Record<string, number>> {
  await requireAdmin()
  const col = await waitlist()
  const docs = await col.find({ notified: false }).project<{ date: string }>({ date: 1 }).toArray()
  const counts: Record<string, number> = {}
  for (const d of docs) counts[d.date] = (counts[d.date] ?? 0) + 1
  return counts
}
