'use server'

import { randomBytes } from 'crypto'
import { ObjectId, type WithId } from 'mongodb'
import { after } from 'next/server'
import { unstable_cache, updateTag } from 'next/cache'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { bookingNotificationEmail, bookingClientCopyEmail, bookingReminderEmail } from '@/lib/email-templates'
import { getAdminEmail } from '@/lib/admin-config'
import { buildICS } from '@/lib/ics'
import { fetchPortfolio } from '@/actions/portfolio'
import { notifyWaitlist } from '@/actions/waitlist'
import { requireAdmin } from '@/lib/require-admin'
import { getClientIp } from '@/lib/client-ip'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — avoids visual ambiguity
const MAX_PER_HOUR = 5
const LOOKUP_RATE_LIMIT_PER_HOUR = 20
const CANCEL_RATE_LIMIT_PER_HOUR = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
// Africa/Libreville is a fixed UTC+1 offset with no DST, so wall-clock
// arithmetic can use a constant offset instead of pulling in a timezone
// library just for this.
const TZ_OFFSET = '+01:00'

export interface BookingPayload {
  clientNom: string
  clientEmail: string
  clientTelephone?: string
  message?: string
  start: string // ISO datetime
}

export interface Booking extends BookingPayload {
  accessCode: string
  end: string
  durationMinutes: number
  status: 'confirmed' | 'cancelled'
  createdAt: string
  // 'admin' = an event Nawaf blocked directly from the back office (no
  // client attached) — still occupies the slot everywhere (public page,
  // chatbot), just never triggers client emails or rate limiting.
  source: 'admin' | 'client'
  // Auto-generated Jitsi room (no account/API key needed, unlike Google
  // Meet) — unique per booking, included in every booking email + the ICS
  // file's LOCATION field.
  meetingUrl: string
}

export interface AdminBooking extends Booking {
  id: string
  read: boolean
}

interface BookingRecord {
  clientNom: string
  clientEmail: string
  clientTelephone?: string
  message?: string
  start: Date
  end: Date
  durationMinutes: number
  accessCode: string
  status: 'confirmed' | 'cancelled'
  read: boolean
  createdAt: Date
  source?: 'admin' | 'client'
  reminderSent?: boolean
  meetingUrl?: string
}

function bookings() {
  return getDb().then((db) => db.collection<BookingRecord>('bookings'))
}

function generateAccessCode(length = 6): string {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return code
}

// Jitsi needs no account/API key (unlike Google Meet) — a long random room
// name is the whole access control, so anyone with the link can join but
// nobody can guess it.
function generateMeetingUrl(): string {
  return `https://meet.jit.si/PortfolioNS-${randomBytes(10).toString('hex')}`
}

function toBooking(doc: WithId<BookingRecord>): Booking {
  return {
    clientNom: doc.clientNom,
    clientEmail: doc.clientEmail,
    clientTelephone: doc.clientTelephone,
    message: doc.message,
    start: doc.start.toISOString(),
    end: doc.end.toISOString(),
    durationMinutes: doc.durationMinutes,
    accessCode: doc.accessCode,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    source: doc.source ?? 'client',
    // Bookings created before this feature shipped have no stored room —
    // derive a stable one from their access code rather than leaving it empty.
    meetingUrl: doc.meetingUrl ?? `https://meet.jit.si/PortfolioNS-${doc.accessCode}`,
  }
}

// ── Slot computation ─────────────────────────────────────────────────────
// One portfolio fetch + one bookings query cover an entire requested range
// (a single day or a full month) — callers never trigger a query per day.

function toInstant(dateISO: string, time: string): Date {
  return new Date(`${dateISO}T${time}:00${TZ_OFFSET}`)
}

// Renders a UTC instant as its "HH:mm" wall-clock in the fixed +01:00 zone.
function hhmm(d: Date): string {
  const shifted = new Date(d.getTime() + 60 * 60 * 1000)
  return shifted.toISOString().slice(11, 16)
}

function isoDate(d: Date): string {
  const shifted = new Date(d.getTime() + 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

async function computeSlots(fromISO: string, toISO: string): Promise<Record<string, string[]>> {
  const portfolio = await fetchPortfolio()
  const availability = portfolio?.availability
  if (!availability) return {}

  const rangeStart = toInstant(fromISO, '00:00')
  const rangeEnd = toInstant(toISO, '23:59')
  const now = new Date()
  const windowEnd = new Date(now.getTime() + availability.bookingWindowDays * 86_400_000)

  const col = await bookings()
  const existing = await col
    .find({ status: 'confirmed', start: { $lt: rangeEnd }, end: { $gt: rangeStart } })
    .project<Pick<BookingRecord, 'start' | 'end'>>({ start: 1, end: 1 })
    .toArray()

  const slotMs = availability.slotMinutes * 60_000
  const bufferMs = availability.bufferMinutes * 60_000
  const result: Record<string, string[]> = {}

  for (let cursor = new Date(rangeStart); cursor <= rangeEnd; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const dateISOStr = isoDate(cursor)
    const dow = toInstant(dateISOStr, '12:00').getDay()
    const hours = availability.weeklyHours.find((h) => h.day === dow)
    if (!hours?.enabled || availability.blackoutDates.includes(dateISOStr)) continue

    const dayStart = toInstant(dateISOStr, hours.start)
    const dayEnd = toInstant(dateISOStr, hours.end)
    if (dayStart > windowEnd) continue

    const slots: string[] = []
    for (let t = dayStart.getTime(); t + slotMs <= dayEnd.getTime(); t += slotMs) {
      const slotStart = new Date(t)
      const slotEnd = new Date(t + slotMs)
      if (slotStart < now || slotStart > windowEnd) continue
      const conflict = existing.some(
        (b) => slotStart.getTime() < b.end.getTime() + bufferMs && slotEnd.getTime() + bufferMs > b.start.getTime(),
      )
      if (!conflict) slots.push(hhmm(slotStart))
    }
    if (slots.length) result[dateISOStr] = slots
  }

  return result
}

// Read-only view of the same computation, for the browse paths (calendar
// grid, chatbot suggestions) where a minute of staleness is invisible but the
// cost is not: every month navigation and every "when are you free?" used to
// re-read the portfolio, re-query the bookings table and re-derive every slot
// from scratch. Invalidated on any booking change via updateTag('bookings')
// and on any admin publish via the shared 'portfolio' tag.
//
// Deliberately NOT used by bookMeeting: the final double-booking check has to
// see the live bookings table, not a cached snapshot of it.
const cachedComputeSlots = unstable_cache(
  (fromISO: string, toISO: string) => computeSlots(fromISO, toISO),
  ['booking-slots'],
  { tags: ['portfolio', 'bookings'], revalidate: 60 },
)

// Invalidation is best-effort: `updateTag` needs a genuine Server Action
// context and bookMeeting/cancelBooking are also reachable from the chatbot's
// Route Handler. A miss just means falling back to the 60s revalidate, so it
// must never fail the write that preceded it.
function invalidateBookingSlots() {
  try {
    updateTag('bookings')
  } catch {
    /* not a Server Action context — the 60s revalidate covers it */
  }
}

// Single day — used by the public slot picker and the chatbot.
export async function getDaySlots(dateISO: string): Promise<string[]> {
  const map = await computeSlots(dateISO, dateISO)
  return map[dateISO] ?? []
}

// Whole month — used by the calendar grid to show which days have openings.
export async function getMonthSlots(year: number, month: number): Promise<Record<string, string[]>> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return cachedComputeSlots(from, to)
}

// `time` is the Africa/Libreville wall-clock label; `iso` is the same slot's
// absolute instant, letting a visitor's browser render it in their own
// timezone without re-deriving it from the Libreville-local string.
export interface DaySlot { time: string; iso: string; available: boolean }

// Full day schedule — both open AND taken slots — so the public page can
// show a visitor that a slot is already booked instead of just silently
// omitting it. Never exposes who booked it, only that it's unavailable.
export async function getDaySchedule(dateISO: string): Promise<DaySlot[]> {
  const portfolio = await fetchPortfolio()
  const availability = portfolio?.availability
  if (!availability) return []

  const dow = toInstant(dateISO, '12:00').getDay()
  const hours = availability.weeklyHours.find((h) => h.day === dow)
  if (!hours?.enabled || availability.blackoutDates.includes(dateISO)) return []

  const now = new Date()
  const windowEnd = new Date(now.getTime() + availability.bookingWindowDays * 86_400_000)
  const dayStart = toInstant(dateISO, hours.start)
  const dayEnd = toInstant(dateISO, hours.end)
  if (dayStart > windowEnd) return []

  const col = await bookings()
  const existing = await col
    .find({ status: 'confirmed', start: { $lt: dayEnd }, end: { $gt: dayStart } })
    .project<Pick<BookingRecord, 'start' | 'end'>>({ start: 1, end: 1 })
    .toArray()

  const slotMs = availability.slotMinutes * 60_000
  const bufferMs = availability.bufferMinutes * 60_000
  const out: DaySlot[] = []
  for (let t = dayStart.getTime(); t + slotMs <= dayEnd.getTime(); t += slotMs) {
    const slotStart = new Date(t)
    const slotEnd = new Date(t + slotMs)
    if (slotStart < now || slotStart > windowEnd) continue
    const conflict = existing.some(
      (b) => slotStart.getTime() < b.end.getTime() + bufferMs && slotEnd.getTime() + bufferMs > b.start.getTime(),
    )
    out.push({ time: hhmm(slotStart), iso: slotStart.toISOString(), available: !conflict })
  }
  return out
}

// Next few open days — used by the chatbot when the visitor hasn't named a
// specific date. One computeSlots call covers the whole 3-week scan window
// instead of querying per candidate day.
export async function getUpcomingAvailability(maxDays = 5): Promise<{ date: string; slots: string[] }[]> {
  const from = isoDate(new Date())
  const to = isoDate(new Date(Date.now() + 21 * 86_400_000))
  const map = await cachedComputeSlots(from, to)
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxDays)
    .map(([date, slots]) => ({ date, slots }))
}

// ── Public: create a booking ─────────────────────────────────────────────

let bookingRlIndexReady: Promise<void> | null = null
function ensureBookingRlIndex() {
  if (!bookingRlIndexReady) {
    bookingRlIndexReady = getDb()
      .then((db) => db.collection('booking_ratelimits').createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }))
      .then(() => undefined)
      .catch(() => {})
  }
  return bookingRlIndexReady
}

async function checkBookingRateLimit(scope: string, maxPerHour: number): Promise<boolean> {
  // Index setup, the connection and the request headers are three independent
  // awaits; only the count actually has to happen before the decision.
  const [, db, ip] = await Promise.all([ensureBookingRlIndex(), getDb(), getClientIp()])
  const since = new Date(Date.now() - 3600 * 1000)
  const count = await db.collection('booking_ratelimits').countDocuments({ scope, ip, createdAt: { $gte: since } })
  if (count >= maxPerHour) return false
  // Started immediately so concurrent requests still count against the
  // window, but not awaited — nothing downstream reads the result.
  void db
    .collection('booking_ratelimits')
    .insertOne({ scope, ip, createdAt: new Date() })
    .catch((e) => console.error('[checkBookingRateLimit] write failed:', e))
  return true
}

export async function bookMeeting(payload: BookingPayload): Promise<Booking> {
  if (!payload.clientNom?.trim() || payload.clientNom.length > 200) throw new Error('Nom requis.')
  if (!payload.clientEmail?.trim() || !EMAIL_RE.test(payload.clientEmail.trim()) || payload.clientEmail.length > 254) {
    throw new Error('Email invalide.')
  }
  if (!payload.start) throw new Error('Créneau requis.')
  if (payload.clientTelephone && payload.clientTelephone.length > 30) throw new Error('Téléphone invalide.')
  if (payload.message && payload.message.length > 2000) throw new Error('Message trop long.')

  const start = new Date(payload.start)
  const dateISOStr = isoDate(start)

  // The rate-limit gate, the connection and the availability read are
  // independent of each other, so they run together rather than as four
  // sequential round trips before the visitor learns whether their slot is
  // still free. `getDaySlots` is deliberately the UNcached path: it is the
  // authoritative double-booking check and must see the live bookings table.
  const [allowed, db, portfolio, available] = await Promise.all([
    checkBookingRateLimit('book-meeting', MAX_PER_HOUR),
    getDb(),
    fetchPortfolio(),
    getDaySlots(dateISOStr),
  ])

  if (!allowed) {
    throw new Error('Trop de réservations pour le moment. Réessayez dans un instant.')
  }

  const availability = portfolio?.availability
  if (!availability) throw new Error('Le calendrier n\'est pas encore configuré.')

  if (!available.includes(hhmm(start))) {
    throw new Error('Ce créneau n\'est plus disponible — merci d\'en choisir un autre.')
  }

  const end = new Date(start.getTime() + availability.slotMinutes * 60_000)
  const accessCode = generateAccessCode()
  const meetingUrl = generateMeetingUrl()
  const record: BookingRecord = {
    clientNom: payload.clientNom.trim(),
    clientEmail: payload.clientEmail.trim(),
    clientTelephone: payload.clientTelephone?.trim() || undefined,
    message: payload.message?.trim() || undefined,
    start,
    end,
    durationMinutes: availability.slotMinutes,
    accessCode,
    status: 'confirmed',
    read: false,
    createdAt: new Date(),
    meetingUrl,
  }

  const { insertedId } = await db.collection<BookingRecord>('bookings').insertOne(record)
  const booking = toBooking({ ...record, _id: insertedId })
  invalidateBookingSlots()

  after(async () => {
    try {
      const transporter = getTransporter()
      const adminEmail = await getAdminEmail()
      const ics = buildICS({
        uid: `${insertedId.toString()}@nawafsalami-itech`,
        start, end,
        summary: `Rendez-vous avec ${booking.clientNom}`,
        description: booking.message,
        location: booking.meetingUrl,
        organizerEmail: adminEmail,
        attendeeEmail: booking.clientEmail,
      })

      const notification = bookingNotificationEmail(booking)
      await transporter.sendMail({
        from: `"Portfolio NS · Rendez-vous" <${process.env.GMAIL_USER}>`,
        to: adminEmail,
        subject: notification.subject,
        html: notification.html,
        icalEvent: { filename: 'rendez-vous.ics', content: ics },
      })

      const clientCopy = bookingClientCopyEmail(booking, adminEmail)
      await transporter.sendMail({
        from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
        to: booking.clientEmail,
        subject: clientCopy.subject,
        html: clientCopy.html,
        icalEvent: { filename: 'rendez-vous.ics', content: ics },
      })
    } catch (e) {
      console.error('[bookMeeting] email error:', e)
    }
  })

  return booking
}

// ── Admin: block a slot directly (no client) ─────────────────────────────
// Same underlying record as a real booking, so it automatically occupies
// the slot everywhere that reads confirmed bookings — the public page, the
// admin grid, and the chatbot's checkAvailability/bookMeeting — with no
// separate blocking mechanism to keep in sync.

export async function createEvent(payload: { title: string; start: string; durationMinutes: number }): Promise<Booking> {
  await requireAdmin()
  if (!payload.title?.trim()) throw new Error('Titre requis.')
  if (!payload.start) throw new Error('Créneau requis.')

  const start = new Date(payload.start)
  const durationMinutes = payload.durationMinutes > 0 ? payload.durationMinutes : 30
  const end = new Date(start.getTime() + durationMinutes * 60_000)

  const col = await bookings()
  const conflict = await col.findOne({ status: 'confirmed', start: { $lt: end }, end: { $gt: start } })
  if (conflict) throw new Error('Ce créneau chevauche déjà un événement ou un rendez-vous existant.')

  const accessCode = generateAccessCode()
  const record: BookingRecord = {
    clientNom: payload.title.trim(),
    clientEmail: '',
    start,
    end,
    durationMinutes,
    accessCode,
    status: 'confirmed',
    read: true, // created by the admin — no unread notification needed
    createdAt: new Date(),
    source: 'admin',
    meetingUrl: generateMeetingUrl(),
  }

  const { insertedId } = await col.insertOne(record)
  invalidateBookingSlots()
  return toBooking({ ...record, _id: insertedId })
}

// Retrieve a booking by its access code, so a visitor can find or cancel it
// again without going through the chat.
export async function lookupBooking(accessCode: string): Promise<Booking | null> {
  if (typeof accessCode !== 'string') return null
  const code = accessCode.trim().toUpperCase()
  if (!code) return null
  if (!(await checkBookingRateLimit('lookup-booking', LOOKUP_RATE_LIMIT_PER_HOUR))) return null
  const col = await bookings()
  const doc = await col.findOne({ accessCode: code })
  return doc ? toBooking(doc) : null
}

export async function cancelBooking(accessCode: string): Promise<{ ok: boolean; message: string }> {
  if (typeof accessCode !== 'string') return { ok: false, message: 'Requête invalide.' }
  const code = accessCode.trim().toUpperCase()
  if (!(await checkBookingRateLimit('cancel-booking', CANCEL_RATE_LIMIT_PER_HOUR))) {
    return { ok: false, message: 'Trop de tentatives. Réessayez plus tard.' }
  }
  const col = await bookings()
  const doc = await col.findOne({ accessCode: code })
  if (!doc) return { ok: false, message: 'Rendez-vous introuvable pour ce code.' }
  if (doc.status === 'cancelled') return { ok: true, message: 'Ce rendez-vous était déjà annulé.' }

  await col.updateOne({ _id: doc._id }, { $set: { status: 'cancelled' } })
  invalidateBookingSlots()
  after(() => notifyWaitlist(isoDate(doc.start)))
  return { ok: true, message: 'Le rendez-vous a été annulé.' }
}

// ── Admin actions ─────────────────────────────────────────────────────────

export async function listBookings(): Promise<AdminBooking[]> {
  await requireAdmin()
  const col = await bookings()
  const docs = await col.find({}).sort({ start: -1 }).limit(200).toArray()
  return docs.map((doc) => ({
    ...toBooking(doc),
    id: doc._id.toString(),
    read: doc.read ?? false,
  }))
}

export async function markBookingRead(id: string): Promise<void> {
  await requireAdmin()
  const col = await bookings()
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { read: true } })
}

export async function adminCancelBooking(id: string): Promise<void> {
  await requireAdmin()
  const col = await bookings()
  const doc = await col.findOne({ _id: new ObjectId(id) })
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'cancelled' } })
  invalidateBookingSlots()
  if (doc) after(() => notifyWaitlist(isoDate(doc.start)))
}

export async function deleteBooking(id: string): Promise<void> {
  await requireAdmin()
  const col = await bookings()
  await col.deleteOne({ _id: new ObjectId(id) })
  invalidateBookingSlots()
}

// ── Reminders ─────────────────────────────────────────────────────────────
// Called by a daily cron (see /api/cron/booking-reminders). A 24-48h window
// checked once a day — rather than a precise "N hours before" checked
// hourly — guarantees exactly one reminder per booking even on Vercel's
// Hobby plan, which only allows daily cron invocations.
export async function sendDueReminders(): Promise<{ sent: number }> {
  const col = await bookings()
  const now = new Date()
  const windowStart = new Date(now.getTime() + 24 * 3_600_000)
  const windowEnd = new Date(now.getTime() + 48 * 3_600_000)

  const due = await col
    .find({
      status: 'confirmed',
      source: { $ne: 'admin' },
      reminderSent: { $ne: true },
      start: { $gte: windowStart, $lte: windowEnd },
    })
    .toArray()

  if (due.length === 0) return { sent: 0 }

  const transporter = getTransporter()
  const adminEmail = await getAdminEmail()
  let sent = 0

  for (const doc of due) {
    const booking = toBooking(doc)
    try {
      const reminder = bookingReminderEmail(booking, adminEmail)
      await transporter.sendMail({
        from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
        to: booking.clientEmail,
        subject: reminder.subject,
        html: reminder.html,
      })
      await col.updateOne({ _id: doc._id }, { $set: { reminderSent: true } })
      sent++
    } catch (e) {
      console.error('[sendDueReminders] email error for booking', doc._id.toString(), e)
    }
  }

  return { sent }
}
