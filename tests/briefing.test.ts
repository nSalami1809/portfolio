import { describe, it, expect } from 'vitest'
import { buildBriefing, type BriefingInputs } from '@/lib/briefing'
import type { BusinessStats } from '@/lib/business-stats'

const counts = { unreadContacts: 0, unreadQuotes: 0, unreadBookings: 0, pendingTestimonials: 0, failedMails: 0, unreadChats: 0, assistantDrafts: 0 }
const business = {
  pipeline: {}, conversionRate: null, avgDaysToSign: null,
  cash: { billed: 0, collected: 0, outstanding: 0, overdue: 150000, overdueCount: 2 }, months: [],
  inProgress: [{ numero: 'DEV-2026-004', clientNom: 'SECRET-CLIENT', totalTTC: 1, dueAt: '2026-10-01', late: true }],
  awaitingRecette: [],
  todo: [{ kind: 'issue_deposit', numero: 'DEV-2026-004', clientNom: 'SECRET-CLIENT' }, { kind: 'invoice_overdue', numero: 'DEV-2026-002', clientNom: 'AUTRE-CLIENT' }],
} as unknown as BusinessStats
const inputs = (over: Partial<BriefingInputs> = {}): BriefingInputs => ({ business: null, counts, bookingsToday: 0, bookingsTomorrow: 0, ...over })

describe('buildBriefing', () => {
  it('says so when there is nothing to do', () => {
    expect(buildBriefing(inputs(), { includeNames: true })).toEqual({ summary: 'Rien à traiter pour le moment.', items: [] })
  })

  it('orders urgent items first and groups tasks by kind', () => {
    const b = buildBriefing(inputs({ business, counts: { ...counts, unreadContacts: 3, failedMails: 1 }, bookingsToday: 1 }), { includeNames: true })
    const levels = b.items.map((i) => i.level)
    expect(levels).toEqual([...levels].sort((a, c) => ['urgent', 'todo', 'info'].indexOf(a) - ['urgent', 'todo', 'info'].indexOf(c)))
    expect(b.items.find((i) => i.id === 'contacts:unread')?.title).toBe('3 nouveaux messages de contact')
    expect(b.items.find((i) => i.id === 'cash:overdue')?.level).toBe('urgent')
    expect(b.summary).toMatch(/urgence/)
  })

  it('shows client names to the administrator but never to the assistant', () => {
    expect(JSON.stringify(buildBriefing(inputs({ business }), { includeNames: true }))).toContain('SECRET-CLIENT')
    const forModel = JSON.stringify(buildBriefing(inputs({ business }), { includeNames: false }))
    expect(forModel).not.toMatch(/SECRET-CLIENT|AUTRE-CLIENT/)
    expect(forModel).toContain('DEV-2026-004') // references are kept
  })
})
