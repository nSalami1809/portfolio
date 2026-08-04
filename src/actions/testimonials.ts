'use server'

import { headers } from 'next/headers'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { testimonialNotificationEmail } from '@/lib/email-templates'
import { getAdminEmail } from '@/lib/admin-config'
import { requireAdmin } from '@/lib/require-admin'

const MAX_PER_HOUR = 3

// Run once per cold start — idempotent in MongoDB, avoids the round-trip on every request
let indexesReady: Promise<void> | null = null
async function ensureIndexes() {
  const db = await getDb()
  await Promise.all([
    db.collection('testimonial_ratelimits').createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }),
    db.collection('testimonial_submissions').createIndex({ createdAt: -1 }),
  ])
}
function getIndexes() {
  if (!indexesReady) indexesReady = ensureIndexes().catch(() => {})
  return indexesReady
}

// ── Types ──────────────────────────────────────────────────────────────────

export type TestimonialSubmissionPayload = {
  name: string
  role?: string
  company?: string
  text: string
  rating: number
}

export type SubmitTestimonialResult =
  | { ok: true }
  | { ok: false; error: string }

// Everything in the testimonial_submissions collection is, by definition,
// awaiting moderation — approving or declining removes the doc (see below),
// so no status field is needed here.
export type TestimonialSubmission = {
  id: string
  name: string
  role: string
  company: string
  text: string
  rating: number
  createdAt: string
}

// ── Public action: submit ───────────────────────────────────────────────────
// Visitor-submitted testimonials never touch PortfolioData directly — they
// land in this separate moderation queue, exactly like contacts/quotes/
// bookings, so a public submission can never race with the admin's
// full-document CMS publish flow.

export async function submitTestimonial(payload: TestimonialSubmissionPayload): Promise<SubmitTestimonialResult> {
  if (!payload.name?.trim() || payload.name.length > 100) return { ok: false, error: 'Nom invalide.' }
  if (payload.role && payload.role.length > 100) return { ok: false, error: 'Poste invalide.' }
  if (payload.company && payload.company.length > 100) return { ok: false, error: 'Entreprise invalide.' }
  if (!payload.text?.trim() || payload.text.length > 1000) return { ok: false, error: 'Témoignage invalide (1000 caractères maximum).' }
  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) return { ok: false, error: 'Note invalide.' }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim()
    ?? hdrs.get('x-real-ip')
    ?? 'unknown'

  const [db] = await Promise.all([getDb(), getIndexes()])

  const since = new Date(Date.now() - 3600 * 1000)
  const count = await db.collection('testimonial_ratelimits').countDocuments({ ip, createdAt: { $gte: since } })
  if (count >= MAX_PER_HOUR) {
    return { ok: false, error: 'Limite atteinte (3 témoignages/h). Réessayez plus tard.' }
  }

  const name = payload.name.trim()
  const role = payload.role?.trim() || ''
  const company = payload.company?.trim() || ''
  const text = payload.text.trim()

  await db.collection('testimonial_ratelimits').insertOne({ ip, createdAt: new Date() })
  await db.collection('testimonial_submissions').insertOne({ name, role, company, text, rating: payload.rating, ip, createdAt: new Date() })

  try {
    const transporter = getTransporter()
    const email = testimonialNotificationEmail({ name, role, company, text, rating: payload.rating })
    await transporter.sendMail({
      from: `"Portfolio NS · Témoignages" <${process.env.GMAIL_USER}>`,
      to: await getAdminEmail(),
      subject: email.subject,
      html: email.html,
    })
  } catch (e) {
    console.error('[submitTestimonial] email error:', e)
  }

  return { ok: true }
}

// ── Admin: moderation queue ──────────────────────────────────────────────────

export async function listPendingTestimonials(): Promise<TestimonialSubmission[]> {
  await requireAdmin()
  const db = await getDb()
  const docs = await db.collection('testimonial_submissions').find({}).sort({ createdAt: -1 }).limit(100).toArray()
  return docs.map(({ _id, createdAt, ...rest }) => ({
    id: (_id as ObjectId).toString(),
    name: rest.name ?? '',
    role: rest.role ?? '',
    company: rest.company ?? '',
    text: rest.text ?? '',
    rating: typeof rest.rating === 'number' ? rest.rating : 5,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
  }))
}

// Approval itself (copying into PortfolioData.testimonials) happens on the
// client via the existing updateTestimonials flow — this just removes the
// now-published submission from the moderation queue.
export async function resolveTestimonialSubmission(id: string): Promise<void> {
  await requireAdmin()
  const db = await getDb()
  await db.collection('testimonial_submissions').deleteOne({ _id: new ObjectId(id) })
}
