'use server'

import { headers } from 'next/headers'
import { ObjectId } from 'mongodb'
import { promises as dns } from 'dns'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { contactNotificationEmail, contactAutoReplyEmail } from '@/lib/email-templates'

const MAX_PER_HOUR = 3

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

// Returns false only when we're certain the domain has no MX records.
// On timeout or DNS error, we allow through (permissive).
async function domainHasMx(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  try {
    const check = dns.resolveMx(domain)
      .then((r) => r.length > 0)
      .catch((err: NodeJS.ErrnoException) => {
        // ENOTFOUND = domain doesn't exist, ENODATA = no MX records
        if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') return false
        return true // other DNS error → allow through
      })
    const timeout = new Promise<true>((res) => setTimeout(() => res(true), 4000))
    return await Promise.race([check, timeout])
  } catch {
    return true
  }
}

// Run once per cold start — idempotent in MongoDB, avoids the round-trip on every request
let indexesReady: Promise<void> | null = null
async function ensureIndexes() {
  const db = await getDb()
  await Promise.all([
    db.collection('ratelimits').createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }),
    db.collection('contacts').createIndex({ createdAt: -1 }),
  ])
}
function getIndexes() {
  if (!indexesReady) indexesReady = ensureIndexes().catch(() => {})
  return indexesReady
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ContactPayload = {
  name: string
  email: string
  phone?: string
  subject: string
  customSubject?: string
  message: string
}

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string }

export type ContactMessage = {
  id: string
  name: string
  email: string
  phone?: string
  subject: string
  customSubject?: string
  message: string
  ip: string
  createdAt: string
  read: boolean
}

// ── Public action: submit ──────────────────────────────────────────────────

export async function submitContact(payload: ContactPayload): Promise<ContactResult> {
  // ── 1. Length + format checks ──
  if (!payload.name?.trim() || payload.name.length > 100) return { ok: false, error: 'Nom invalide.' }
  if (!EMAIL_RE.test(payload.email) || payload.email.length > 254) {
    return { ok: false, error: 'Adresse email invalide.' }
  }
  if (payload.phone && payload.phone.length > 30) return { ok: false, error: 'Numéro invalide.' }
  if (!payload.message?.trim() || payload.message.length > 3000) return { ok: false, error: 'Message invalide.' }
  if (payload.customSubject && payload.customSubject.length > 120) return { ok: false, error: 'Objet trop long.' }

  // ── 2. MX check — does this domain actually receive emails? ──
  const mxOk = await domainHasMx(payload.email)
  if (!mxOk) {
    return { ok: false, error: "Ce domaine email n'existe pas ou ne peut pas recevoir de messages. Vérifiez l'adresse saisie." }
  }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim()
    ?? hdrs.get('x-real-ip')
    ?? 'unknown'

  const [db] = await Promise.all([getDb(), getIndexes()])

  const since = new Date(Date.now() - 3600 * 1000)
  const count = await db.collection('ratelimits').countDocuments({ ip, createdAt: { $gte: since } })
  if (count >= MAX_PER_HOUR) {
    return { ok: false, error: 'Limite atteinte (3 messages/h). Réessayez plus tard.' }
  }

  await db.collection('ratelimits').insertOne({ ip, createdAt: new Date() })
  await db.collection('contacts').insertOne({ ...payload, ip, createdAt: new Date(), read: false })

  // Notification to admin + auto-reply to visitor (non-blocking)
  try {
    const transporter = getTransporter()
    const notification = contactNotificationEmail(payload)
    const autoReply = contactAutoReplyEmail(payload)

    await Promise.all([
      transporter.sendMail({
        from: `"Portfolio NS · Contact" <${process.env.GMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: notification.subject,
        html: notification.html,
      }),
      transporter.sendMail({
        from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
        to: payload.email,
        subject: autoReply.subject,
        html: autoReply.html,
      }),
    ])
  } catch (e) {
    console.error('[submitContact] email error:', e)
  }

  return { ok: true }
}

// ── Admin actions ──────────────────────────────────────────────────────────

export async function listContacts(): Promise<ContactMessage[]> {
  const db = await getDb()
  const docs = await db.collection('contacts')
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()

  return docs.map(({ _id, createdAt, ...rest }) => ({
    id: (_id as ObjectId).toString(),
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    name: rest.name ?? '',
    email: rest.email ?? '',
    phone: rest.phone ?? '',
    subject: rest.subject ?? '',
    customSubject: rest.customSubject ?? '',
    message: rest.message ?? '',
    ip: rest.ip ?? '',
    read: rest.read ?? false,
  }))
}

export async function markContactRead(id: string): Promise<void> {
  const db = await getDb()
  await db.collection('contacts').updateOne(
    { _id: new ObjectId(id) },
    { $set: { read: true } },
  )
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDb()
  await db.collection('contacts').deleteOne({ _id: new ObjectId(id) })
}
