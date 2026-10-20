import { describe, it, expect, vi } from 'vitest'
import { buildAssistantTools } from '@/lib/assistant/tools'
import { quotesToFollowUp, reminderHistory, suggestTone } from '@/lib/assistant/reminders'
import { buildBriefing, type BriefingInputs } from '@/lib/briefing'
import { fakeDeps, pendingQuotes, run } from './assistant-helpers'

vi.mock('@/lib/mongodb', () => ({ getDb: async () => { throw new Error('no database in unit tests') } }))

const NOW = new Date('2026-10-17T10:00:00Z')
const reminderDraft = (numero: string, sentAt: string | null, sentCount: number) => ({ kind: 'email_reminder', payload: { quoteNumero: numero }, sentAt, sentCount })

describe('reminder history', () => {
  it('counts the reminders marked as sent, per quote', () => {
    const h = reminderHistory([
      reminderDraft('DEV-1', '2026-10-10T09:00:00Z', 1),
      reminderDraft('DEV-1', '2026-10-14T09:00:00Z', 2),
      reminderDraft('DEV-2', null, 0),
      { kind: 'blog_post', payload: {}, sentAt: '2026-10-01T00:00:00Z', sentCount: 5 },
    ])
    expect(h.get('DEV-1')).toEqual({ count: 3, lastAt: '2026-10-14T09:00:00Z' })
    expect(h.has('DEV-2')).toBe(false)
    expect(h.size).toBe(1)
  })

  it('suggests a politer tone first, firmer after, and the last call at the end', () => {
    expect(suggestTone(0, false)).toBe('courtois')
    expect(suggestTone(1, false)).toBe('direct')
    expect(suggestTone(2, false)).toBe('dernier')
    expect(suggestTone(0, true)).toBe('dernier')
  })
})

describe('quotes to follow up', () => {
  const q = (numero: string, daysAgo: number) => ({ numero, clientNom: `Client ${numero}`, dateEmission: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString() })

  it('keeps old enough quotes that were never reminded, oldest first', () => {
    const out = quotesToFollowUp([q('B', 8), q('A', 20), q('C', 3)], new Map(), NOW)
    expect(out.map((f) => f.numero)).toEqual(['A', 'B'])
    expect(out[0]).toMatchObject({ daysWaiting: 20, reminders: 0, daysSinceReminder: null })
  })

  it('leaves out a quote that was reminded recently, and brings it back after a week', () => {
    const recent = new Map([['A', { count: 1, lastAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString() }]])
    const old = new Map([['A', { count: 1, lastAt: new Date(NOW.getTime() - 8 * 86_400_000).toISOString() }]])
    expect(quotesToFollowUp([q('A', 20)], recent, NOW)).toEqual([])
    expect(quotesToFollowUp([q('A', 20)], old, NOW)[0]).toMatchObject({ reminders: 1, daysSinceReminder: 8 })
  })
})

describe('briefing line', () => {
  const inputs = (): BriefingInputs => ({
    business: null, bookingsToday: 0, bookingsTomorrow: 0,
    counts: { unreadContacts: 0, unreadQuotes: 0, unreadBookings: 0, pendingTestimonials: 0, failedMails: 0, unreadChats: 0, assistantDrafts: 0 },
    followUps: [{ numero: 'DEV-2026-014', clientNom: 'Awa Mbeki', daysWaiting: 16, reminders: 0, daysSinceReminder: null }],
  })

  it('tells the admin which quotes to remind, with names', () => {
    const item = buildBriefing(inputs(), { includeNames: true }).items.find((i) => i.id === 'quotes:followup')!
    expect(item.title).toBe('1 devis à relancer')
    expect(item.detail).toContain('DEV-2026-014 · Awa Mbeki (16 j, jamais relancé)')
  })

  it('gives the assistant the reference only, never the name', () => {
    const item = buildBriefing(inputs(), { includeNames: false }).items.find((i) => i.id === 'quotes:followup')!
    expect(item.detail).toContain('DEV-2026-014')
    expect(JSON.stringify(item)).not.toContain('Mbeki')
  })

  it('is absent when nothing is due', () => {
    const none = { ...inputs(), followUps: [] }
    expect(buildBriefing(none, { includeNames: true }).items.some((i) => i.id === 'quotes:followup')).toBe(false)
  })
})

describe('reminder tools use the history', () => {
  it('shows what was sent and the tone to use next', async () => {
    const { deps, drafts } = fakeDeps()
    const tools = buildAssistantTools(deps)
    const made = await run(tools.draftQuoteReminder, { quoteNumero: 'DEV-2026-014' })
    const d = drafts.store.get(made.draftId)!
    drafts.store.set(d.id, { ...d, sentAt: '2026-10-10T09:00:00Z', sentCount: 1 })
    const list = await run(tools.listPendingQuotes)
    const first = list.find((x: { numero: string }) => x.numero === 'DEV-2026-014')
    expect(first).toMatchObject({ remindersSent: 1, daysSinceLastReminder: 7, suggestedTone: 'direct' })
    expect(list.find((x: { numero: string }) => x.numero === 'DEV-2026-016')).toMatchObject({ remindersSent: 0, daysSinceLastReminder: null, suggestedTone: 'courtois' })
  })

  it('picks the suggested tone by default and warns when a reminder just went out', async () => {
    const { deps, drafts } = fakeDeps()
    const tools = buildAssistantTools(deps)
    const first = await run(tools.draftQuoteReminder, { quoteNumero: 'DEV-2026-014' })
    expect(first.tone).toBe('courtois')
    expect(first.warning).toBeUndefined()
    const d = drafts.store.get(first.draftId)!
    drafts.store.set(d.id, { ...d, sentAt: '2026-10-16T09:00:00Z', sentCount: 1 })
    const next = await run(tools.draftQuoteReminder, { quoteNumero: 'DEV-2026-014' })
    expect(next.tone).toBe('direct')
    expect(next.warning).toContain('il y a 1 jour')
    expect(JSON.stringify(next)).not.toMatch(/Mbeki|awa@/)
  })

  it('honours an explicit tone', async () => {
    const { deps } = fakeDeps()
    const out = await run(buildAssistantTools(deps).draftQuoteReminder, { quoteNumero: 'DEV-2026-016', tone: 'dernier' })
    expect(out.tone).toBe('dernier')
    expect(pendingQuotes).toHaveLength(2)
  })
})
