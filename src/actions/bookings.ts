'use server'

import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { ObjectId, type WithId } from 'mongodb'
import { after } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { bookingNotificationEmail, bookingClientCopyEmail } from '@/lib/email-templates'
import { getAdminEmail } from '@/lib/admin-config'
import { buildICS } from '@/lib/ics'
import { fetchPortfolio } from '@/actions/portfolio'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — avoids visual ambiguity
const MAX_PER_HOUR = 5
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
  return computeSlots(from, to)
}

// Next few open days — used by the chatbot when the visitor hasn't named a
// specific date. One computeSlots call covers the whole 3-week scan window
// instead of querying per candidate day.
export async function getUpcomingAvailability(maxDays = 5): Promise<{ date: string; slots: string[] }[]> {
  const from = isoDate(new Date())
  const to = isoDate(new Date(Date.now() + 21 * 86_400_000))
  const map = await computeSlots(from, to)
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxDays)
    .map(([date, slots]) => ({ date, slots }))
}

// ── Public: create a booking ─────────────────────────────────────────────

export async function bookMeeting(payload: BookingPayload): Promise<Booking> {
  if (!payload.clientNom?.trim()) throw new Error('Nom requis.')
  if (!payload.clientEmail?.trim()) throw new Error('Email requis.')
  if (!payload.start) throw new Error('Créneau requis.')

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? 'unknown'

  const db = await getDb()
  await db.collection('booking_ratelimits').createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }).catch(() => {})
  const since = new Date(Date.now() - 3600 * 1000)
  const count = await db.collection('booking_ratelimits').countDocuments({ ip, createdAt: { $gte: since } })
  if (count >= MAX_PER_HOUR) throw new Error('Trop de réservations pour le moment. Réessayez dans un instant.')

  const portfolio = await fetchPortfolio()
  const availability = portfolio?.availability
  if (!availability) throw new Error('Le calendrier n\'est pas encore configuré.')

  const start = new Date(payload.start)
  const dateISOStr = isoDate(start)
  const available = await getDaySlots(dateISOStr)
  if (!available.includes(hhmm(start))) {
    throw new Error('Ce créneau n\'est plus disponible — merci d\'en choisir un autre.')
  }

  const end = new Date(start.getTime() + availability.slotMinutes * 60_000)
  const accessCode = generateAccessCode()
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
  }

  await db.collection('booking_ratelimits').insertOne({ ip, createdAt: new Date() })
  const { insertedId } = await db.collection<BookingRecord>('bookings').insertOne(record)
  const booking = toBooking({ ...record, _id: insertedId })

  after(async () => {
    try {
      const transporter = getTransporter()
      const adminEmail = await getAdminEmail()
      const ics = buildICS({
        uid: `${insertedId.toString()}@nawafsalami-itech`,
        start, end,
        summary: `Rendez-vous avec ${booking.clientNom}`,
        description: booking.message,
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

// Retrieve a booking by its access code, so a visitor can find or cancel it
// again without going through the chat.
export async function lookupBooking(accessCode: string): Promise<Booking | null> {
  const code = accessCode.trim().toUpperCase()
  if (!code) return null
  const col = await bookings()
  const doc = await col.findOne({ accessCode: code })
  return doc ? toBooking(doc) : null
}

export async function cancelBooking(accessCode: string): Promise<{ ok: boolean; message: string }> {
  const code = accessCode.trim().toUpperCase()
  const col = await bookings()
  const doc = await col.findOne({ accessCode: code })
  if (!doc) return { ok: false, message: 'Rendez-vous introuvable pour ce code.' }
  if (doc.status === 'cancelled') return { ok: true, message: 'Ce rendez-vous était déjà annulé.' }

  await col.updateOne({ _id: doc._id }, { $set: { status: 'cancelled' } })
  return { ok: true, message: 'Le rendez-vous a été annulé.' }
}

// ── Admin actions ─────────────────────────────────────────────────────────

export async function listBookings(): Promise<AdminBooking[]> {
  const col = await bookings()
  const docs = await col.find({}).sort({ start: -1 }).limit(200).toArray()
  return docs.map((doc) => ({
    ...toBooking(doc),
    id: doc._id.toString(),
    read: doc.read ?? false,
  }))
}

export async function markBookingRead(id: string): Promise<void> {
  const col = await bookings()
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { read: true } })
}

export async function adminCancelBooking(id: string): Promise<void> {
  const col = await bookings()
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'cancelled' } })
}

export async function deleteBooking(id: string): Promise<void> {
  const col = await bookings()
  await col.deleteOne({ _id: new ObjectId(id) })
}
