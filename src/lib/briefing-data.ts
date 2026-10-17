import 'server-only'

import { getDb } from '@/lib/mongodb'
import { getBusinessStats } from '@/actions/business'
import type { BriefingInputs } from '@/lib/briefing'

// Reads what the briefing needs: the same counts the notification bell shows, the
// agenda of today and tomorrow, and the business figures of the "Activité" page.
// Read-only. (It goes through getBusinessStats, which checks the admin session, so
// it cannot be used without one.)
export async function loadBriefingInputs(now: Date = new Date()): Promise<BriefingInputs> {
  const db = await getDb()
  const startOfToday = new Date(now)
  startOfToday.setUTCHours(0, 0, 0, 0)
  const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000)
  const endOfTomorrow = new Date(startOfToday.getTime() + 2 * 86_400_000)
  const confirmed = { status: 'confirmed' }

  const [counts, business] = await Promise.all([
    Promise.all([
      db.collection('contacts').countDocuments({ read: false }),
      db.collection('quotes').countDocuments({ read: false }),
      db.collection('bookings').countDocuments({ read: false }),
      db.collection('testimonial_submissions').countDocuments({}),
      db.collection('mail_failures').countDocuments({ resolved: false }),
      db.collection('chat_conversations').countDocuments({ read: false }),
      db.collection('assistant_drafts').countDocuments({ status: 'draft' }),
      db.collection('bookings').countDocuments({ ...confirmed, start: { $gte: startOfToday, $lt: startOfTomorrow } }),
      db.collection('bookings').countDocuments({ ...confirmed, start: { $gte: startOfTomorrow, $lt: endOfTomorrow } }),
    ]),
    getBusinessStats().catch((e) => {
      console.error('[briefing] business stats unavailable:', e)
      return null
    }),
  ])
  const [unreadContacts, unreadQuotes, unreadBookings, pendingTestimonials, failedMails, unreadChats, assistantDrafts, bookingsToday, bookingsTomorrow] = counts
  return {
    business,
    counts: { unreadContacts, unreadQuotes, unreadBookings, pendingTestimonials, failedMails, unreadChats, assistantDrafts },
    bookingsToday,
    bookingsTomorrow,
  }
}
