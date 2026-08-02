'use server'

import { after } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { escalationEmail } from '@/lib/email-templates'
import { getAdminEmail } from '@/lib/admin-config'

// Called by the chatbot when a visitor explicitly wants to reach a human
// directly, or the bot genuinely can't help after a few tries. Unlike a
// quote/booking/message, this needs to reach the admin *immediately* —
// the record is kept for a paper trail, but the email is the real channel.
export async function requestHumanHelp(payload: { reason: string; visitorEmail?: string }): Promise<{ ok: boolean; message: string }> {
  const reason = payload.reason?.trim()
  if (!reason) return { ok: false, message: 'Un motif est requis.' }

  const db = await getDb()
  await db.collection('escalations').insertOne({
    reason: reason.slice(0, 1000),
    visitorEmail: payload.visitorEmail?.trim() || undefined,
    createdAt: new Date(),
  })

  after(async () => {
    try {
      const transporter = getTransporter()
      const adminEmail = await getAdminEmail()
      const email = escalationEmail({ reason, visitorEmail: payload.visitorEmail })
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
