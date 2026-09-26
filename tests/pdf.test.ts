import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { generateQuotePdf } from '@/lib/quote-pdf'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { computeTotals, snapshotTerms, splitPayment, splitTTC } from '@/lib/business'
import type { Invoice } from '@/lib/invoicing'
import { DATE, ITEMS, PERSONAL, makeQuote } from './fixtures'

// Nothing listens here: the logo / signature downloads fail fast and the
// generators must still produce a complete document without them.
const SITE = 'http://127.0.0.1:1'

const pages = async (pdf: Buffer) => (await PDFDocument.load(pdf)).getPageCount()
const isPdf = (pdf: Buffer) => pdf.subarray(0, 5).toString('latin1') === '%PDF-'

const delivered = { deliveredAt: '2026-02-10T09:00:00.000Z', note: 'Livré.', liveUrl: 'https://client.example' }
const signature = { name: 'Client Test', email: 'c@e.com', imageUrl: 'http://127.0.0.1:1/x.png', signedAt: '2026-01-16T10:00:00.000Z', documentHash: 'a'.repeat(64) }

describe('quote PDFs', () => {
  it('renders every document variant as a valid PDF', async () => {
    const jobs = [
      generateQuotePdf({ quote: makeQuote(), personal: PERSONAL, variant: 'devis', siteUrl: SITE }),
      generateQuotePdf({ quote: makeQuote({ status: 'accepted', signature }), personal: PERSONAL, variant: 'contrat', siteUrl: SITE }),
      generateQuotePdf({ quote: makeQuote({ kind: 'avenant', parentNumero: 'DEV-2026-001', numero: 'AVN-2026-001', status: 'accepted', signature }), personal: PERSONAL, variant: 'contrat', siteUrl: SITE }),
      generateQuotePdf({ quote: makeQuote({ status: 'accepted', signature, delivery: delivered }), personal: PERSONAL, variant: 'pv', siteUrl: SITE }),
    ]
    for (const pdf of await Promise.all(jobs)) {
      expect(isPdf(pdf)).toBe(true)
      expect(await pages(pdf)).toBeGreaterThanOrEqual(1)
    }
  })

  it('keeps the delivery report on a single page, signed or not', async () => {
    const base = { status: 'accepted' as const, signature, delivery: delivered }
    const waiting = await generateQuotePdf({ quote: makeQuote(base), personal: PERSONAL, variant: 'pv', siteUrl: SITE })
    const signedPv = await generateQuotePdf({
      quote: makeQuote({ ...base, acceptance: { ...signature, reserves: 'La page contact.' } }),
      personal: PERSONAL, variant: 'pv', siteUrl: SITE,
    })
    expect(await pages(waiting)).toBe(1)
    expect(await pages(signedPv)).toBe(1)
  })

  it('stamps a sample as such', async () => {
    const plain = await generateQuotePdf({ quote: makeQuote(), personal: PERSONAL, variant: 'devis', siteUrl: SITE })
    const sample = await generateQuotePdf({ quote: makeQuote(), personal: PERSONAL, variant: 'devis', siteUrl: SITE, watermark: 'EXEMPLE' })
    expect(isPdf(sample)).toBe(true)
    expect(sample.length).toBeGreaterThan(plain.length)
  })
})

function makeInvoice(kind: 'acompte' | 'solde', extra: Partial<Invoice> = {}): Invoice {
  const terms = snapshotTerms(PERSONAL)
  const totals = computeTotals(ITEMS, terms)
  const gross = kind === 'acompte' ? splitPayment(totals.totalTTC, terms.depositPercent).acompte : totals.totalTTC
  const split = splitTTC(gross, terms)
  return {
    id: '1', numero: 'FAC-2026-001', quoteNumero: 'DEV-2026-001', quoteKind: 'devis', kind, status: 'issued', issuedAt: DATE, dueAt: DATE,
    lines: kind === 'acompte' ? [{ designation: 'Acompte', quantite: 1, prixUnitaireHT: split.ht }] : ITEMS,
    totalHT: kind === 'acompte' ? split.ht : totals.totalHT, tva: kind === 'acompte' ? split.tva : totals.tva, totalTTC: gross,
    deductions: [], netToPay: gross, client: { nom: 'Client Test' }, terms, ...extra,
  }
}

describe('invoice PDFs', () => {
  it('renders invoices and receipts', async () => {
    const paid = { status: 'paid' as const, payment: { paidAt: DATE, method: 'Airtel Money', receiptNumero: 'REC-2026-001' } }
    for (const pdf of await Promise.all([
      generateInvoicePdf({ invoice: makeInvoice('acompte'), document: 'facture', siteUrl: SITE }),
      generateInvoicePdf({ invoice: makeInvoice('solde', { deductions: [{ label: 'Acompte', amountTTC: 1000 }], netToPay: 5000 }), document: 'facture', siteUrl: SITE }),
      generateInvoicePdf({ invoice: makeInvoice('acompte', paid), document: 'recu', siteUrl: SITE }),
    ])) {
      expect(isPdf(pdf)).toBe(true)
      expect(await pages(pdf)).toBe(1)
    }
  })
})
