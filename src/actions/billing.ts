'use server'

import { ObjectId, type WithId } from 'mongodb'
import { after } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { loggedMailer } from '@/lib/mail-safe'
import { getAdminEmail } from '@/lib/admin-config'
import { requireAdmin } from '@/lib/require-admin'
import { invoiceEmail, receiptEmail } from '@/lib/email-client'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { resolveTerms, splitPayment, splitTTC, type QuoteTerms } from '@/lib/business'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { quotesCol, toQuote, SITE_URL, type QuoteRecordEvent } from '@/lib/quotes-core'
import type { QuoteKind } from '@/actions/quotes'

// Sequential, gap-free numbering (FAC-2026-001, REC-2026-001): an atomic
// counter document per prefix and year rather than "count + 1", so two
// invoices issued at the same moment can never get the same number.
async function nextSequence(prefix: 'FAC' | 'REC'): Promise<string> {
  const db = await getDb()
  const year = new Date().getFullYear()
  const doc = await db.collection<{ _id: string; seq: number }>('counters').findOneAndUpdate(
    { _id: `${prefix}-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  return `${prefix}-${year}-${String(doc?.seq ?? 1).padStart(3, '0')}`
}

export type InvoiceKind = 'acompte' | 'solde'
export type InvoiceStatus = 'issued' | 'paid' | 'cancelled'

export interface InvoiceLine {
  designation: string
  quantite: number
  prixUnitaireHT: number
}

export interface InvoicePayment {
  paidAt: string
  method: string
  reference?: string
  receiptNumero: string
}

export interface InvoiceClient {
  nom: string
  societe?: string
  adresse?: string
  email?: string
  telephone?: string
}

export interface Invoice {
  id: string
  numero: string
  quoteNumero: string
  quoteKind: QuoteKind
  kind: InvoiceKind
  status: InvoiceStatus
  issuedAt: string
  dueAt: string
  lines: InvoiceLine[]
  // Amounts of what the lines add up to (before deductions), then the
  // deductions (a balance invoice subtracts the deposit already invoiced),
  // then what is actually due.
  totalHT: number
  tva: number
  totalTTC: number
  deductions: { label: string; amountTTC: number }[]
  netToPay: number
  client: InvoiceClient
  terms: QuoteTerms
  // Language of the client's emails (from the quote).
  locale?: 'fr' | 'en'
  payment?: InvoicePayment
  cancelledAt?: string
}

interface InvoiceRecord extends Omit<Invoice, 'id' | 'issuedAt' | 'dueAt' | 'payment' | 'cancelledAt'> {
  issuedAt: Date
  dueAt: Date
  payment?: Omit<InvoicePayment, 'paidAt'> & { paidAt: Date }
  cancelledAt?: Date
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d)

function toInvoice(doc: WithId<InvoiceRecord>): Invoice {
  const { _id, issuedAt, dueAt, payment, cancelledAt, ...rest } = doc
  return {
    ...rest,
    id: _id.toString(),
    issuedAt: iso(issuedAt),
    dueAt: iso(dueAt),
    payment: payment ? { ...payment, paidAt: iso(payment.paidAt) } : undefined,
    cancelledAt: cancelledAt ? iso(cancelledAt) : undefined,
  }
}

// The provider's current signature (stamped on every invoice and receipt).
async function providerSignatureUrl(): Promise<string | undefined> {
  const portfolio = await fetchPortfolioSafe('billing-signature')
  return (portfolio?.personal ?? defaultPersonalInfo).signatureUrl || undefined
}

let invoiceIndexes: Promise<unknown> | null = null

async function invoicesCol() {
  const db = await getDb()
  const col = db.collection<InvoiceRecord>('invoices')
  if (!invoiceIndexes) {
    // Once per instance, off the request path; a failure just means "no index yet".
    invoiceIndexes = Promise.all([
      col.createIndex({ numero: 1 }, { unique: true }),
      col.createIndex({ quoteNumero: 1 }),
      col.createIndex({ status: 1, issuedAt: -1 }),
    ]).catch((e) => console.error('[invoices] index creation failed:', e))
  }
  return col
}

export type BillingResult = { ok: true; message: string; invoice?: Invoice } | { ok: false; message: string }

const KIND_LABEL: Record<InvoiceKind, string> = { acompte: "d'acompte", solde: 'de solde' }

async function pushQuoteEvent(quoteNumero: string, event: QuoteRecordEvent) {
  const col = await quotesCol()
  await col.updateOne({ numero: quoteNumero }, { $push: { events: event } })
}

async function sendInvoiceMail(invoice: Invoice, document: 'facture' | 'recu', record = true): Promise<boolean> {
  if (!invoice.client.email) return false
  try {
    const transporter = loggedMailer({ kind: document, invoiceId: invoice.id }, { record })
    const adminEmail = await getAdminEmail()
    const content = await generateInvoicePdf({ invoice, document, siteUrl: SITE_URL, signatureUrl: await providerSignatureUrl() })
    const mail = document === 'facture' ? invoiceEmail(invoice, adminEmail) : receiptEmail(invoice, adminEmail)
    const number = document === 'facture' ? invoice.numero : invoice.payment?.receiptNumero
    return await transporter.sendMail({
      from: `"${invoice.terms.provider.name}" <${process.env.GMAIL_USER}>`,
      to: invoice.client.email,
      subject: mail.subject,
      html: mail.html,
      attachments: [{ filename: `${document === 'facture' ? 'Facture' : 'Recu'}-${number}.pdf`, content, contentType: 'application/pdf' }],
    })
  } catch (e) {
    console.error('[billing] email error:', e)
    return false
  }
}

// Admin retry of a failed invoice / receipt email: awaited (unlike the
// background send after issuing), so the admin learns the real outcome.
export async function retryInvoiceEmail(invoiceId: string, document: 'facture' | 'recu'): Promise<boolean> {
  await requireAdmin()
  const col = await invoicesCol()
  const doc = await col.findOne({ _id: new ObjectId(invoiceId) })
  if (!doc) return false
  return sendInvoiceMail(toInvoice(doc), document, false)
}

// ── Admin actions ────────────────────────────────────────────────────────────

export async function listInvoices(): Promise<Invoice[]> {
  await requireAdmin()
  const col = await invoicesCol()
  const docs = await col.find({}).sort({ issuedAt: -1 }).limit(500).toArray()
  return docs.map(toInvoice)
}

export async function issueInvoice(quoteId: string, kind: InvoiceKind): Promise<BillingResult> {
  await requireAdmin()
  if (kind !== 'acompte' && kind !== 'solde') return { ok: false, message: 'Type de facture invalide.' }

  const qcol = await quotesCol()
  const qdoc = await qcol.findOne({ _id: new ObjectId(quoteId) })
  if (!qdoc) return { ok: false, message: 'Devis introuvable.' }
  if ((qdoc.status ?? 'pending') !== 'accepted') {
    return { ok: false, message: "Le devis doit être accepté (signé) avant d'émettre une facture." }
  }
  const quote = toQuote(qdoc)
  const portfolio = await fetchPortfolioSafe('issueInvoice')
  const terms = resolveTerms(qdoc, portfolio?.personal ?? defaultPersonalInfo)
  const hasDeposit = terms.depositPercent > 0 && terms.depositPercent < 100

  const col = await invoicesCol()
  const existing = await col.find({ quoteNumero: quote.numero, status: { $ne: 'cancelled' } }).toArray()
  if (existing.some((i) => i.kind === kind)) {
    return { ok: false, message: `Une facture ${KIND_LABEL[kind]} existe déjà pour ce devis.` }
  }

  const docLabel = quote.kind === 'avenant' ? 'avenant' : 'devis'
  let lines: InvoiceLine[]
  let totalHT: number
  let tva: number
  let totalTTC: number
  let deductions: Invoice['deductions'] = []

  if (kind === 'acompte') {
    if (!hasDeposit) return { ok: false, message: "Ce devis ne prévoit pas d'acompte." }
    totalTTC = splitPayment(quote.totalTTC, terms.depositPercent).acompte
    const split = splitTTC(totalTTC, terms)
    totalHT = split.ht
    tva = split.tva
    lines = [{ designation: `Acompte de ${terms.depositPercent} % sur ${docLabel} n° ${quote.numero}`, quantite: 1, prixUnitaireHT: totalHT }]
  } else {
    if (!quote.delivery) return { ok: false, message: "Le projet doit être marqué comme livré avant d'émettre la facture de solde." }
    const acompte = existing.find((i) => i.kind === 'acompte')
    if (hasDeposit) {
      if (!acompte || acompte.status !== 'paid') {
        return { ok: false, message: "L'acompte doit être facturé puis marqué comme payé avant la facture de solde." }
      }
      deductions = [{ label: `Acompte déjà réglé (facture ${acompte.numero})`, amountTTC: acompte.totalTTC }]
    }
    lines = quote.items
    totalHT = quote.totalHT
    tva = quote.tva
    totalTTC = quote.totalTTC
  }
  const netToPay = totalTTC - deductions.reduce((s, d) => s + d.amountTTC, 0)

  const issuedAt = new Date()
  // A deposit is due as soon as it is issued (the project starts once it is
  // paid); only the balance gets the usual payment delay.
  const dueAt = new Date(issuedAt)
  if (kind === 'solde') dueAt.setDate(dueAt.getDate() + terms.paymentDueDays)
  const numero = await nextSequence('FAC')

  const record: InvoiceRecord = {
    numero, quoteNumero: quote.numero, quoteKind: quote.kind, kind, status: 'issued',
    issuedAt, dueAt, lines, totalHT, tva, totalTTC, deductions, netToPay,
    client: {
      nom: quote.clientNom, societe: quote.clientSociete, adresse: quote.clientAdresse,
      email: quote.clientEmail, telephone: quote.clientTelephone,
    },
    terms,
    locale: quote.locale,
  }
  const { insertedId } = await col.insertOne(record)
  const invoice = toInvoice({ ...record, _id: insertedId })

  await pushQuoteEvent(quote.numero, { type: 'invoice_issued', at: issuedAt, meta: { numero, kind } })
  after(() => sendInvoiceMail(invoice, 'facture'))

  return {
    ok: true,
    invoice,
    message: invoice.client.email ? `Facture ${numero} émise et envoyée au client.` : `Facture ${numero} émise (le client n'a pas d'email : téléchargez-la pour la lui remettre).`,
  }
}

export async function markInvoicePaid(
  invoiceId: string,
  input: { method: string; reference?: string; paidAt?: string },
): Promise<BillingResult> {
  await requireAdmin()
  const method = input.method?.trim()
  if (!method || method.length > 100) return { ok: false, message: 'Moyen de paiement requis.' }
  const reference = input.reference?.trim().slice(0, 100) || undefined
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date()
  if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 86_400_000) return { ok: false, message: 'Date de paiement invalide.' }

  const col = await invoicesCol()
  const doc = await col.findOne({ _id: new ObjectId(invoiceId) })
  if (!doc) return { ok: false, message: 'Facture introuvable.' }
  if (doc.status !== 'issued') return { ok: false, message: doc.status === 'paid' ? 'Cette facture est déjà payée.' : 'Cette facture est annulée.' }

  const receiptNumero = await nextSequence('REC')
  const payment = { paidAt, method, reference, receiptNumero }
  // Compare-and-set on status so a double click can't consume two receipt
  // numbers for the same invoice.
  const result = await col.updateOne({ _id: doc._id, status: 'issued' }, { $set: { status: 'paid', payment } })
  if (result.matchedCount === 0) return { ok: false, message: 'Cette facture a déjà été traitée.' }

  const invoice = toInvoice({ ...doc, status: 'paid', payment })
  await pushQuoteEvent(doc.quoteNumero, { type: 'invoice_paid', at: paidAt, meta: { numero: doc.numero, receipt: receiptNumero, method } })
  after(() => sendInvoiceMail(invoice, 'recu'))

  return { ok: true, invoice, message: `Paiement enregistré — reçu ${receiptNumero}${invoice.client.email ? ' envoyé au client' : ''}.` }
}

// Invoices are accounting records: they are never deleted, only cancelled
// (their number stays used), and only while unpaid.
export async function cancelInvoice(invoiceId: string, reason?: string): Promise<BillingResult> {
  await requireAdmin()
  const col = await invoicesCol()
  const doc = await col.findOne({ _id: new ObjectId(invoiceId) })
  if (!doc) return { ok: false, message: 'Facture introuvable.' }
  if (doc.status !== 'issued') return { ok: false, message: 'Seule une facture non payée peut être annulée.' }
  const cancelledAt = new Date()
  const result = await col.updateOne({ _id: doc._id, status: 'issued' }, { $set: { status: 'cancelled', cancelledAt } })
  if (result.matchedCount === 0) return { ok: false, message: 'Cette facture a déjà été traitée.' }
  await pushQuoteEvent(doc.quoteNumero, { type: 'invoice_cancelled', at: cancelledAt, meta: { numero: doc.numero, ...(reason?.trim() ? { reason: reason.trim().slice(0, 200) } : {}) } })
  return { ok: true, invoice: toInvoice({ ...doc, status: 'cancelled', cancelledAt }), message: `Facture ${doc.numero} annulée.` }
}

export async function resendInvoiceEmail(invoiceId: string, document: 'facture' | 'recu'): Promise<BillingResult> {
  await requireAdmin()
  const col = await invoicesCol()
  const doc = await col.findOne({ _id: new ObjectId(invoiceId) })
  if (!doc) return { ok: false, message: 'Facture introuvable.' }
  if (!doc.client.email) return { ok: false, message: "Ce client n'a pas d'email enregistré." }
  if (document === 'recu' && doc.status !== 'paid') return { ok: false, message: "Cette facture n'a pas encore été payée." }
  const invoice = toInvoice(doc)
  after(() => sendInvoiceMail(invoice, document))
  return { ok: true, message: 'Email renvoyé au client.' }
}

export async function downloadInvoicePdf(
  invoiceId: string,
  document: 'facture' | 'recu',
): Promise<{ ok: true; filename: string; base64: string } | { ok: false; error: string }> {
  await requireAdmin()
  const col = await invoicesCol()
  const doc = await col.findOne({ _id: new ObjectId(invoiceId) })
  if (!doc) return { ok: false, error: 'Facture introuvable.' }
  if (document === 'recu' && doc.status !== 'paid') return { ok: false, error: "Cette facture n'a pas encore été payée." }
  const invoice = toInvoice(doc)
  try {
    const content = await generateInvoicePdf({ invoice, document, siteUrl: SITE_URL, signatureUrl: await providerSignatureUrl() })
    const number = document === 'facture' ? invoice.numero : invoice.payment!.receiptNumero
    return { ok: true, filename: `${document === 'facture' ? 'Facture' : 'Recu'}-${number}.pdf`, base64: content.toString('base64') }
  } catch (e) {
    console.error('[downloadInvoicePdf] PDF generation failed:', e)
    return { ok: false, error: 'Erreur lors de la génération du PDF.' }
  }
}
