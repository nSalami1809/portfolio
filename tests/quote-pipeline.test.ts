import { describe, it, expect } from 'vitest'
import { PIPELINE_STAGES, attentionCount, buildPipeline, nextAction, stageOf, type PipelineContext, type PipelineQuote } from '@/lib/quote-pipeline'

const NOW = new Date('2026-10-17T10:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()
const quote = (over: Partial<PipelineQuote> = {}): PipelineQuote => ({ id: 'q1', numero: 'DEV-2026-001', clientNom: 'Awa', totalTTC: 1_000_000, status: 'pending', dateEmission: ago(2), validiteJours: 30, events: [], ...over })
const ctx = (over: Partial<PipelineContext> = {}): PipelineContext => ({ now: NOW, unpaid: new Set(), reminders: new Map(), ...over })

describe('stage of a quote', () => {
  it('follows the facts on the quote, furthest stage first', () => {
    expect(stageOf(quote())).toBe('sent')
    expect(stageOf(quote({ events: [{ type: 'created', at: ago(2) }, { type: 'viewed', at: ago(1) }] }))).toBe('viewed')
    expect(stageOf(quote({ signature: { name: 'A' } }))).toBe('signed')
    expect(stageOf(quote({ status: 'accepted' }))).toBe('signed')
    expect(stageOf(quote({ signature: {}, delivery: { deliveredAt: ago(3) } }))).toBe('delivered')
    expect(stageOf(quote({ signature: {}, delivery: { deliveredAt: ago(9) }, acceptance: {} }))).toBe('accepted')
    expect(stageOf(quote({ status: 'declined', events: [{ type: 'viewed', at: ago(1) }] }))).toBe('declined')
  })
})

describe('next action', () => {
  it('waits for a quote sent recently', () => {
    expect(nextAction(quote({ dateEmission: ago(2) }), ctx())).toMatchObject({ key: 'wait', tone: 'info' })
  })

  it('asks for a reminder after a week without answer, with the days in the label', () => {
    const a = nextAction(quote({ dateEmission: ago(16) }), ctx())
    expect(a).toMatchObject({ key: 'remind', tone: 'todo' })
    expect(a.label).toContain('16 j sans réponse')
    expect(a.label).toContain('jamais relancé')
  })

  it('leaves time after a reminder, then asks again a week later', () => {
    const recent = new Map([['DEV-2026-001', { count: 1, lastAt: ago(2) }]])
    const old = new Map([['DEV-2026-001', { count: 1, lastAt: ago(8) }]])
    expect(nextAction(quote({ dateEmission: ago(16) }), ctx({ reminders: recent }))).toMatchObject({ key: 'wait' })
    expect(nextAction(quote({ dateEmission: ago(16) }), ctx({ reminders: old }))).toMatchObject({ key: 'remind' })
    expect(nextAction(quote({ dateEmission: ago(16) }), ctx({ reminders: { 'DEV-2026-001': { count: 1, lastAt: ago(8) } } }))).toMatchObject({ key: 'remind' })
  })

  it('flags an expired quote as late', () => {
    expect(nextAction(quote({ dateEmission: ago(45), validiteJours: 30 }), ctx())).toMatchObject({ key: 'expired', tone: 'late' })
  })

  it('moves on once signed: collect an unpaid invoice, otherwise the project is running', () => {
    const signed = quote({ signature: {} })
    expect(nextAction(signed, ctx({ unpaid: new Set(['DEV-2026-001']) }))).toMatchObject({ key: 'collect', tone: 'todo' })
    expect(nextAction(signed, ctx())).toMatchObject({ key: 'in_progress', tone: 'info' })
  })

  it('watches the acceptance report after delivery, late after a week', () => {
    expect(nextAction(quote({ signature: {}, delivery: { deliveredAt: ago(2) } }), ctx())).toMatchObject({ key: 'await_acceptance', tone: 'info' })
    expect(nextAction(quote({ signature: {}, delivery: { deliveredAt: ago(9) } }), ctx())).toMatchObject({ key: 'await_acceptance', tone: 'late' })
  })

  it('suggests asking for a review once accepted, until it was asked', () => {
    const done = quote({ signature: {}, delivery: { deliveredAt: ago(20) }, acceptance: {} })
    expect(nextAction(done, ctx())).toMatchObject({ key: 'review', tone: 'todo' })
    expect(nextAction({ ...done, testimonialRequestedAt: ago(1) }, ctx())).toMatchObject({ key: 'done', tone: 'done' })
  })

  it('has nothing to do for a declined quote', () => {
    expect(nextAction(quote({ status: 'declined' }), ctx())).toMatchObject({ key: 'done', tone: 'done' })
  })
})

describe('pipeline columns', () => {
  const quotes = [
    quote({ id: 'a', numero: 'A', dateEmission: ago(3), totalTTC: 100 }),
    quote({ id: 'b', numero: 'B', dateEmission: ago(20), totalTTC: 200 }),
    quote({ id: 'c', numero: 'C', dateEmission: ago(10), totalTTC: 300 }),
    quote({ id: 'd', numero: 'D', signature: {}, totalTTC: 400 }),
    quote({ id: 'e', numero: 'E', status: 'declined', totalTTC: 500 }),
  ]

  it('has every stage in order, even empty, and puts each quote once', () => {
    const cols = buildPipeline(quotes, ctx())
    expect(cols.map((c) => c.stage)).toEqual(PIPELINE_STAGES.map((s) => s.stage))
    expect(cols.flatMap((c) => c.cards).length).toBe(quotes.length)
    expect(cols.find((c) => c.stage === 'delivered')!.cards).toEqual([])
  })

  it('puts what needs a move first in a column, then the oldest', () => {
    const sent = buildPipeline(quotes, ctx()).find((c) => c.stage === 'sent')!
    expect(sent.cards.map((c) => c.quote.numero)).toEqual(['B', 'C', 'A'])
    expect(sent.cards.map((c) => c.action.tone)).toEqual(['todo', 'todo', 'info'])
  })

  it('totals each column and counts the quotes that need attention', () => {
    const cols = buildPipeline(quotes, ctx())
    expect(cols.find((c) => c.stage === 'sent')!.totalTTC).toBe(600)
    expect(cols.find((c) => c.stage === 'signed')!.totalTTC).toBe(400)
    expect(attentionCount(cols)).toBe(2)
  })
})
