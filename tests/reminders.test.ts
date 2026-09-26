import { describe, expect, it } from 'vitest'
import { planReminders, type PlanInvoice, type PlanQuote } from '@/lib/reminders'

const D = (s: string) => new Date(s)
const NOW = D('2026-03-10T09:00:00.000Z') // a Tuesday

const quote = (extra: Partial<PlanQuote> = {}): PlanQuote => ({
  id: 'q1', numero: 'DEV-2026-001', status: 'pending', hasClientEmail: true, signed: false,
  dateEmission: D('2026-02-08T09:00:00.000Z'), validiteJours: 30, accepted: false, warrantyDays: 30,
  testimonialRequested: false, hasUnpaidInvoice: false, sent: {}, ...extra,
})
const invoice = (extra: Partial<PlanInvoice> = {}): PlanInvoice => ({
  id: 'i1', numero: 'FAC-2026-001', status: 'issued', hasClientEmail: true, dueAt: D('2026-03-01T09:00:00.000Z'), reminderCount: 0, ...extra,
})
const plan = (quotes: PlanQuote[] = [], invoices: PlanInvoice[] = [], now = NOW) => planReminders({ quotes, invoices, now }).map((a) => a.type)

describe('quote expiring', () => {
  it('reminds once, in the last days of validity', () => {
    expect(plan([quote({ dateEmission: D('2026-02-10T09:00:00.000Z') })])).toEqual(['quote_expiring']) // 2 days left
    expect(plan([quote({ dateEmission: D('2026-02-01T09:00:00.000Z') })])).toEqual([]) // already expired
    expect(plan([quote({ dateEmission: D('2026-02-20T09:00:00.000Z') })])).toEqual([]) // 12 days left
  })

  it('does not repeat, and needs an address and an unsigned quote', () => {
    const soon = { dateEmission: D('2026-02-10T09:00:00.000Z') }
    expect(plan([quote({ ...soon, sent: { expiring: NOW } })])).toEqual([])
    expect(plan([quote({ ...soon, hasClientEmail: false })])).toEqual([])
    expect(plan([quote({ ...soon, signed: true, status: 'accepted' })])).toEqual([])
    expect(plan([quote({ ...soon, status: 'declined' })])).toEqual([])
  })
})

describe('recette', () => {
  const delivered = (deliveredAt: string, extra: Partial<PlanQuote> = {}) => quote({ status: 'accepted', signed: true, deliveredAt: D(deliveredAt), ...extra })

  it('nudges 2 working days before, then deems accepted after 7', () => {
    // delivered Mon 02-23 → deemed Wed 03-04 (7 working days)
    expect(plan([delivered('2026-03-02T09:00:00.000Z')])).toEqual(['recette_reminder']) // deemed Wed 03-11; now Tue 03-10
    expect(plan([delivered('2026-03-09T09:00:00.000Z')])).toEqual([]) // plenty of time left
    expect(plan([delivered('2026-02-23T09:00:00.000Z')])).toEqual(['recette_deemed'])
  })

  it('does nothing once the client signed the report, and never twice', () => {
    expect(plan([delivered('2026-02-23T09:00:00.000Z', { accepted: true })])).not.toContain('recette_deemed')
    expect(plan([delivered('2026-02-23T09:00:00.000Z', { sent: { deemed: NOW } })])).not.toContain('recette_deemed')
    expect(plan([delivered('2026-03-02T09:00:00.000Z', { sent: { recette: NOW } })])).toEqual([])
  })

  it('still records the deemed acceptance when there is no client email', () => {
    expect(plan([delivered('2026-02-23T09:00:00.000Z', { hasClientEmail: false })])).toEqual(['recette_deemed'])
  })
})

describe('warranty end', () => {
  const settled = (extra: Partial<PlanQuote> = {}) => quote({ status: 'accepted', signed: true, accepted: true, deliveredAt: D('2026-01-20T09:00:00.000Z'), ...extra })

  it('asks for a testimonial once the warranty is over and everything is paid', () => {
    expect(plan([settled()])).toEqual(['warranty_end'])
  })

  it('waits for the warranty, the payment, and never asks twice', () => {
    expect(plan([settled({ warrantyDays: 90 })])).toEqual([])
    expect(plan([settled({ hasUnpaidInvoice: true })])).toEqual([])
    expect(plan([settled({ testimonialRequested: true })])).toEqual([])
    expect(plan([settled({ sent: { warranty: NOW } })])).toEqual([])
  })

  it('waits for the recette to be settled', () => {
    expect(plan([settled({ accepted: false, deliveredAt: D('2026-03-06T09:00:00.000Z'), warrantyDays: 0 })])).toEqual([])
  })
})

describe('overdue invoices', () => {
  it('waits for the grace period after the due date', () => {
    expect(plan([], [invoice({ dueAt: D('2026-03-09T09:00:00.000Z') })])).toEqual([]) // 1 day late
    expect(plan([], [invoice({ dueAt: D('2026-03-08T09:00:00.000Z') })])).toEqual(['invoice_overdue']) // 2 days late
  })

  it('repeats weekly, at most three times', () => {
    const late = { dueAt: D('2026-02-01T09:00:00.000Z') }
    expect(plan([], [invoice({ ...late, reminderCount: 1, lastReminderAt: D('2026-03-05T09:00:00.000Z') })])).toEqual([])
    expect(plan([], [invoice({ ...late, reminderCount: 1, lastReminderAt: D('2026-03-03T09:00:00.000Z') })])).toEqual(['invoice_overdue'])
    expect(plan([], [invoice({ ...late, reminderCount: 3, lastReminderAt: D('2026-02-01T09:00:00.000Z') })])).toEqual([])
  })

  it('ignores paid and cancelled invoices, and invoices with no address', () => {
    const late = { dueAt: D('2026-02-01T09:00:00.000Z') }
    expect(plan([], [invoice({ ...late, status: 'paid' }), invoice({ ...late, status: 'cancelled' }), invoice({ ...late, hasClientEmail: false })])).toEqual([])
  })

  it('numbers the reminder', () => {
    const [a] = planReminders({ quotes: [], invoices: [invoice({ dueAt: D('2026-02-01T09:00:00.000Z'), reminderCount: 1, lastReminderAt: D('2026-02-20T09:00:00.000Z') })], now: NOW })
    expect(a).toMatchObject({ type: 'invoice_overdue', reminderNumber: 2 })
  })
})
