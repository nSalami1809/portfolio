'use server'

import { after } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { escalationEmail } from '@/lib/email-templates'
import { getAdminEmail } from '@/lib/admin-config'
import { getClientIp } from '@/lib/client-ip'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
const MAX_PER_HOUR = 5

let indexReady: Promise<void> | null = null
function ensureIndex() {
  if (!indexReady) {
    indexReady = getDb()
      .then((db) => db.collection('escalation_ratelimits').createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }))
      .then(() => undefined)
      .catch(() => {})
  }
  return indexReady
}

// Called by the chatbot when a visitor explicitly wants to reach a human
// directly, or the bot genuinely can't help after a few tries. Unlike a
// quote/booking/message, this needs to reach the admin *immediately* —
// the record is kept for a paper trail, but the email is the real channel.
export async function requestHumanHelp(payload: {
  reason: string
  clientNom: string
  clientEmail: string
  clientTelephone?: string
}): Promise<{ ok: boolean; message: string }> {
  const reason = payload.reason?.trim().slice(0, 1000)
  const clientNom = payload.clientNom?.trim().slice(0, 200)
  const clientEmail = payload.clientEmail?.trim()
  if (!reason || !clientNom || !clientEmail || !EMAIL_RE.test(clientEmail) || clientEmail.length > 254) {
    return { ok: false, message: 'Nom, email et motif sont requis.' }
  }

  const clientTelephone = payload.clientTelephone?.trim().slice(0, 30) || undefined

  await ensureIndex()
  const db = await getDb()
  const ip = await getClientIp()
  const since = new Date(Date.now() - 3600 * 1000)
  const count = await db.collection('escalation_ratelimits').countDocuments({ ip, createdAt: { $gte: since } })
  if (count >= MAX_PER_HOUR) return { ok: false, message: 'Trop de tentatives. Réessayez plus tard.' }
  await db.collection('escalation_ratelimits').insertOne({ ip, createdAt: new Date() })
  await db.collection('escalations').insertOne({
    reason: reason.slice(0, 1000),
    clientNom,
    clientEmail,
    clientTelephone,
    createdAt: new Date(),
  })

  after(async () => {
    try {
      const transporter = getTransporter()
      const adminEmail = await getAdminEmail()
      const email = escalationEmail({ reason, clientNom, clientEmail, clientTelephone })
      await transporter.sendMail({
        from: `"Portfolio NS · Chatbot" <${process.env.GMAIL_USER}>`,
        to: adminEmail,
        subject: email.subject,
        html: email.html,
      })
    } catch (e) {
      console.error('[requestHumanHelp] email error:', e)
    }
  })

  return { ok: true, message: 'Nawaf a été prévenu directement et vous recontactera dès que possible.' }
}
