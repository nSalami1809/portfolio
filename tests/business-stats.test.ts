import { describe, expect, it } from 'vitest'
import { computeBusinessStats, isInvoiceOverdue } from '@/lib/business-stats'
import type { Invoice } from '@/lib/invoicing'
import { computeTotals, snapshotTerms, splitPayment } from '@/lib/business'
import { ITEMS, PERSONAL, makeQuote } from './fixtures'

const NOW = new Date('2026-03-10T09:00:00.000Z')
const signature = (signedAt: string) => ({ name: 'Client Test', email: 'c@e.com', imageUrl: '', signedAt, documentHash: 'a'.repeat(64) })
const terms = snapshotTerms(PERSONAL)
const totals = computeTotals(ITEMS, terms)
const deposit = splitPayment(totals.totalTTC, terms.depositPercent).acompte

function invoice(extra: Partial<Invoice> = {}): Invoice {
  return {
    id: '1', numero: 'FAC-2026-001', quoteNumero: 'DEV-2026-001', quoteKind: 'devis', kind: 'acompte', status: 'issued',
    issuedAt: '2026-03-01T09:00:00.000Z', dueAt: '2026-03-01T09:00:00.000Z', lines: [], totalHT: 0, tva: 0, totalTTC: deposit,
    deductions: [], netToPay: deposit, client: { nom: 'Client Test' }, terms, ...extra,
  }
}

describe('isInvoiceOverdue', () => {
  it('gives a deposit the normal payment delay, and a balance none', () => {
    const due = '2026-03-01T09:00:00.000Z' // 9 days before NOW; paymentDueDays = 7
    expect(isInvoiceOverdue(invoice({ dueAt: due }), NOW.getTime())).toBe(true)
    expect(isInvoiceOverdue(invoice({ dueAt: '2026-03-05T09:00:00.000Z' }), NOW.getTime())).toBe(false)
    expect(isInvoiceOverdue(invoice({ kind: 'solde', dueAt: '2026-03-09T09:00:00.000Z' }), NOW.getTime())).toBe(true)
    expect(isInvoiceOverdue(invoice({ status: 'paid', dueAt: due }), NOW.getTime())).toBe(false)
  })
})

describe('computeBusinessStats', () => {
  it('counts the pipeline and the conversion rate on devis only', () => {
    const stats = computeBusinessStats([
      makeQuote({ numero: 'A', status: 'accepted', signature: signature('2026-01-17T10:00:00.000Z') }), // signed after 2 days
      makeQuote({ numero: 'B', status: 'declined' }),
      makeQuote({ numero: 'C', dateEmission: '2026-01-01T09:00:00.000Z' }), // expired
      makeQuote({ numero: 'D', dateEmission: '2026-03-01T09:00:00.000Z' }), // pending
      makeQuote({ numero: 'E', kind: 'avenant', status: 'declined' }), // avenants are not part of the pipeline
    ], [], PERSONAL, NOW)
    expect(stats.pipeline.signed.count).toBe(1)
    expect(stats.pipeline.declined.count).toBe(1)
    expect(stats.pipeline.expired.count).toBe(1)
    expect(stats.pipeline.pending).toEqual({ count: 1, amount: totals.totalTTC })
    expect(stats.conversionRate).toBe(33)
    expect(stats.avgDaysToSign).toBe(2)
  })

  it('has no rate or average without decided quotes', () => {
    const stats = computeBusinessStats([], [], PERSONAL, NOW)
    expect(stats.conversionRate).toBeNull()
    expect(stats.avgDaysToSign).toBeNull()
    expect(stats.months).toHaveLength(12)
  })

  it('adds up cash and monthly collections, ignoring cancelled invoices', () => {
    const stats = computeBusinessStats([], [
      invoice({ numero: 'F1', status: 'paid', payment: { paidAt: '2026-03-05T09:00:00.000Z', method: 'Airtel', receiptNumero: 'R1' } }),
      invoice({ numero: 'F2', dueAt: '2026-02-01T09:00:00.000Z' }), // overdue
      invoice({ numero: 'F3', status: 'cancelled' }),
    ], PERSONAL, NOW)
    expect(stats.cash).toEqual({ billed: deposit * 2, collected: deposit, outstanding: deposit, overdue: deposit, overdueCount: 1 })
    expect(stats.months.at(-1)).toEqual({ key: '2026-03', collected: deposit })
    expect(stats.todo.map((t) => t.kind)).toEqual(['invoice_overdue'])
  })

  it('lists work in progress and what to invoice next', () => {
    const signed = { status: 'accepted' as const, signature: signature('2026-02-02T10:00:00.000Z') }
    const stats = computeBusinessStats([
      makeQuote({ numero: 'P', ...signed }), // in progress, no deposit invoice yet
      makeQuote({ numero: 'L', ...signed, delivery: { deliveredAt: '2026-02-20T09:00:00.000Z' } }), // delivered, recette expired
    ], [invoice({ numero: 'F', quoteNumero: 'L', status: 'paid', payment: { paidAt: '2026-02-03T09:00:00.000Z', method: 'x', receiptNumero: 'R' } })], PERSONAL, NOW)
    expect(stats.inProgress.map((p) => p.numero)).toEqual(['P'])
    expect(stats.awaitingRecette.map((p) => [p.numero, p.late])).toEqual([['L', true]])
    expect(stats.todo).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'issue_deposit', numero: 'P' }),
      expect.objectContaining({ kind: 'issue_balance', numero: 'L' }),
      expect.objectContaining({ kind: 'recette_deemed', numero: 'L' }),
    ]))
  })
})
