import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  buildAcceptanceBlocks, buildAvenantBlocks, buildContractBlocks, buildDevisBlocks, briefEntries, devisAcceptanceLabel, type DocBlock,
} from '@/lib/quote-document'
import { generateQuotePdf } from '@/lib/quote-pdf'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { computeTotals, snapshotTerms } from '@/lib/business'
import { paymentMethodsFor, roleFor, vatExemptionFor } from '@/lib/doc-common'
import type { Invoice } from '@/lib/invoicing'
import { DATE, ITEMS, PERSONAL, SITE, makeQuote } from './fixtures'

const en = (extra = {}) => makeQuote({ locale: 'en', ...extra })
const text = (blocks: DocBlock[]) => blocks.flatMap((b) => [b.title, ...(b.paragraphs ?? []), ...(b.bullets ?? [])]).join('\n')
const signature = { name: 'Client Test', email: 'c@e.com', imageUrl: 'http://127.0.0.1:1/x.png', signedAt: '2026-01-16T10:00:00.000Z', documentHash: 'a'.repeat(64) }

// Words that only appear in the French wording: none may leak into an English document.
const FRENCH = /\b(Prestataire|jours? ouvrés?|Le Client|Le Prestataire|devis n°|Conditions Générales|pénalités de retard|acompte|Fait à|est réputée)\b/

describe('English documents', () => {
  it('writes the four documents in English, with no French wording', () => {
    const contract = en({ status: 'accepted', signature })
    const docs = {
      devis: buildDevisBlocks(en(), PERSONAL, SITE),
      contrat: buildContractBlocks(contract, PERSONAL, SITE),
      avenant: buildAvenantBlocks(en({ kind: 'avenant', parentNumero: 'DEV-2026-001', numero: 'AVN-2026-001', extraDelayDays: 5 }), PERSONAL),
      pv: buildAcceptanceBlocks(en({ status: 'accepted', signature, delivery: { deliveredAt: '2026-02-10T09:00:00.000Z', note: 'All pages live.', liveUrl: 'https://client.example' } }), PERSONAL),
    }
    for (const [name, blocks] of Object.entries(docs)) {
      expect(blocks.length, name).toBeGreaterThan(2)
      expect(text(blocks), name).not.toMatch(FRENCH)
    }
  })

  it('has the same clauses as the French contract', () => {
    const fr = buildContractBlocks(makeQuote({ status: 'accepted', signature }), PERSONAL, SITE)
    const enBlocks = buildContractBlocks(en({ status: 'accepted', signature }), PERSONAL, SITE)
    expect(enBlocks).toHaveLength(fr.length)
    expect(enBlocks.map((b) => b.title.split(' — ')[0])).toEqual(fr.map((b) => b.title.split(' — ')[0]))
    expect(enBlocks[0].title).toBe('ARTICLE 1 — PURPOSE OF THE CONTRACT')
  })

  it('states the frozen terms and formats amounts and dates in English', () => {
    const t = snapshotTerms(PERSONAL)
    const totals = computeTotals(ITEMS, t)
    const joined = text(buildContractBlocks(en({ status: 'accepted', signature }), PERSONAL, SITE))
    expect(joined).toContain(`${totals.totalTTC.toLocaleString('en-GB')} FCFA`)
    expect(joined).toContain('15 January 2026')
    expect(joined).toContain('30 working days')
    expect(joined).toContain('1.5% per month')
    expect(joined).toContain('Bank transfer')
    expect(joined).toContain('/en/cgv')
  })

  it('numbers the acceptance heading after the last block', () => {
    expect(devisAcceptanceLabel(12, 'en')).toBe('17. ACCEPTANCE OF THE QUOTE')
    expect(briefEntries(en({ brief: { objectifs: 'Sell online' } }))).toEqual([{ label: 'Project goals', value: 'Sell online' }])
  })

  it('translates the provider-typed wordings it knows, and leaves the rest', () => {
    expect(paymentMethodsFor('Virement bancaire, Espèces, Airtel Money', 'en')).toBe('Bank transfer, Cash, Airtel Money')
    expect(paymentMethodsFor('Virement bancaire', 'fr')).toBe('Virement bancaire')
    expect(vatExemptionFor('TVA non applicable', 'en')).toBe('VAT not applicable')
    expect(vatExemptionFor('Franchise en base', 'en')).toBe('Franchise en base')
    expect(roleFor('Développeur Fullstack & DevOps', 'en')).toBe('Fullstack & DevOps developer')
    expect(roleFor('Consultant', 'en')).toBe('Consultant')
  })

  it('keeps a quote without a language in French', () => {
    expect(text(buildDevisBlocks(makeQuote(), PERSONAL, SITE))).toMatch(FRENCH)
  })
})

describe('English PDFs', () => {
  const SITE_DOWN = 'http://127.0.0.1:1'

  it('renders every English variant', async () => {
    const pages = async (pdf: Buffer) => (await PDFDocument.load(pdf)).getPageCount()
    const jobs = [
      generateQuotePdf({ quote: en(), personal: PERSONAL, variant: 'devis', siteUrl: SITE_DOWN }),
      generateQuotePdf({ quote: en({ status: 'accepted', signature }), personal: PERSONAL, variant: 'contrat', siteUrl: SITE_DOWN }),
      generateQuotePdf({ quote: en({ status: 'accepted', signature, delivery: { deliveredAt: '2026-02-10T09:00:00.000Z' } }), personal: PERSONAL, variant: 'pv', siteUrl: SITE_DOWN }),
    ]
    for (const pdf of await Promise.all(jobs)) {
      expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
      expect(await pages(pdf)).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders an English invoice and receipt', async () => {
    const terms = snapshotTerms(PERSONAL)
    const invoice: Invoice = {
      id: '1', numero: 'FAC-2026-001', quoteNumero: 'DEV-2026-001', quoteKind: 'devis', kind: 'acompte', status: 'paid', issuedAt: DATE, dueAt: DATE,
      lines: [{ designation: 'Deposit', quantite: 1, prixUnitaireHT: 1000 }], totalHT: 1000, tva: 180, totalTTC: 1180, deductions: [], netToPay: 1180,
      client: { nom: 'Client Test' }, terms, locale: 'en', payment: { paidAt: DATE, method: 'Airtel Money', receiptNumero: 'REC-2026-001' },
    }
    for (const document of ['facture', 'recu'] as const) {
      const pdf = await generateInvoicePdf({ invoice, document, siteUrl: SITE_DOWN })
      expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    }
  })
})
