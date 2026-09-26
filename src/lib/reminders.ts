// Which automatic reminders are due *right now* — a pure function of the data
// and the clock, so every rule can be tested without a database or a mailbox.
// lib/reminders-run.ts loads the data, calls planReminders, sends and records.
import { addBusinessDays, RECETTE_DAYS } from '@/lib/quote-document'

const DAY = 86_400_000

// A quote about to expire is reminded once, this many days before.
export const EXPIRING_DAYS_BEFORE = 3
// An unpaid invoice is first reminded this many days after its due date, then
// every OVERDUE_REPEAT_DAYS, up to OVERDUE_MAX_REMINDERS times in total.
export const OVERDUE_GRACE_DAYS = 2
export const OVERDUE_REPEAT_DAYS = 7
export const OVERDUE_MAX_REMINDERS = 3
// The client is nudged this many working days before the recette is deemed accepted.
export const RECETTE_REMINDER_DAYS_BEFORE = 2

// Keys of `remindersSent` on a quote: each one-off reminder is sent at most once.
export type OneOffReminder = 'expiring' | 'recette' | 'deemed' | 'warranty'

export interface PlanQuote {
  id: string
  numero: string
  status: 'pending' | 'accepted' | 'declined'
  hasClientEmail: boolean
  signed: boolean
  dateEmission: Date
  validiteJours: number
  deliveredAt?: Date
  accepted: boolean // the client signed the procès-verbal
  warrantyDays: number
  testimonialRequested: boolean
  hasUnpaidInvoice: boolean
  sent: Partial<Record<OneOffReminder, unknown>>
}

export interface PlanInvoice {
  id: string
  numero: string
  status: 'issued' | 'paid' | 'cancelled'
  hasClientEmail: boolean
  dueAt: Date
  reminderCount: number
  lastReminderAt?: Date
}

export type ReminderAction =
  | { type: 'quote_expiring'; quoteId: string; numero: string; expiresAt: Date; daysLeft: number }
  | { type: 'recette_reminder'; quoteId: string; numero: string; deemedAt: Date }
  | { type: 'recette_deemed'; quoteId: string; numero: string; deemedAt: Date }
  | { type: 'warranty_end'; quoteId: string; numero: string }
  | { type: 'invoice_overdue'; invoiceId: string; numero: string; reminderNumber: number }

export function quoteExpiry(q: Pick<PlanQuote, 'dateEmission' | 'validiteJours'>): Date {
  return new Date(q.dateEmission.getTime() + q.validiteJours * DAY)
}

export function planReminders(input: { quotes: PlanQuote[]; invoices: PlanInvoice[]; now: Date }): ReminderAction[] {
  const { now } = input
  const actions: ReminderAction[] = []

  for (const q of input.quotes) {
    // A quote still waiting for a signature.
    if (q.status === 'pending' && !q.signed) {
      const expiresAt = quoteExpiry(q)
      const left = expiresAt.getTime() - now.getTime()
      if (q.hasClientEmail && !q.sent.expiring && left > 0 && left <= EXPIRING_DAYS_BEFORE * DAY) {
        actions.push({ type: 'quote_expiring', quoteId: q.id, numero: q.numero, expiresAt, daysLeft: Math.max(1, Math.ceil(left / DAY)) })
      }
      continue
    }

    if (q.status !== 'accepted' || !q.deliveredAt) continue

    const deemedAt = addBusinessDays(q.deliveredAt, RECETTE_DAYS)
    if (!q.accepted) {
      if (now >= deemedAt) {
        if (!q.sent.deemed) actions.push({ type: 'recette_deemed', quoteId: q.id, numero: q.numero, deemedAt })
      } else if (q.hasClientEmail && !q.sent.recette && now >= addBusinessDaysBack(deemedAt, RECETTE_REMINDER_DAYS_BEFORE)) {
        actions.push({ type: 'recette_reminder', quoteId: q.id, numero: q.numero, deemedAt })
      }
    }

    // End of the warranty → ask for a testimonial, once the delivery is settled
    // (accepted or deemed accepted) and nothing is left unpaid.
    const settled = q.accepted || now >= deemedAt
    const warrantyEnd = new Date(q.deliveredAt.getTime() + q.warrantyDays * DAY)
    if (settled && q.hasClientEmail && !q.testimonialRequested && !q.sent.warranty && !q.hasUnpaidInvoice && now >= warrantyEnd) {
      actions.push({ type: 'warranty_end', quoteId: q.id, numero: q.numero })
    }
  }

  for (const inv of input.invoices) {
    if (inv.status !== 'issued' || !inv.hasClientEmail || inv.reminderCount >= OVERDUE_MAX_REMINDERS) continue
    const firstAt = inv.dueAt.getTime() + OVERDUE_GRACE_DAYS * DAY
    const nextAt = inv.lastReminderAt ? inv.lastReminderAt.getTime() + OVERDUE_REPEAT_DAYS * DAY : firstAt
    if (now.getTime() >= Math.max(firstAt, nextAt)) {
      actions.push({ type: 'invoice_overdue', invoiceId: inv.id, numero: inv.numero, reminderNumber: inv.reminderCount + 1 })
    }
  }

  return actions
}

function addBusinessDaysBack(from: Date, days: number): Date {
  const d = new Date(from)
  let left = days
  while (left > 0) {
    d.setDate(d.getDate() - 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return d
}
