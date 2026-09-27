// Invoice core: types, storage helpers, creation rules and the email/PDF send.
// Lives outside the 'use server' file (actions/billing.ts) so it can also be
// called by trusted server code — the automatic deposit invoice issued when a
// client signs — without exposing any of it as a public endpoint.
import { ObjectId, type WithId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { loggedMailer } from '@/lib/mail-safe'
import { getAdminEmail } from '@/lib/admin-config'
import { invoiceEmail, receiptEmail } from '@/lib/email-client'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { resolveTerms, splitPayment, splitTTC, type QuoteTerms } from '@/lib/business'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { quotesCol, toQuote, SITE_URL, type QuoteRecordEvent } from '@/lib/quotes-core'
import type { QuoteKind } from '@/actions/quotes'

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
  // Tracking code of the quote, printed in every email about it.
  accessCode?: string
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
  // Overdue reminders already sent (see lib/reminders.ts).
  reminderCount?: number
  lastReminderAt?: string
}

export interface InvoiceRecord extends Omit<Invoice, 'id' | 'issuedAt' | 'dueAt' | 'payment' | 'cancelledAt' | 'lastReminderAt'> {
  issuedAt: Date
  dueAt: Date
  payment?: Omit<InvoicePayment, 'paidAt'> & { paidAt: Date }
  cancelledAt?: Date
  lastReminderAt?: Date
}

export type BillingResult = { ok: true; message: string; invoice?: Invoice } | { ok: false; message: string }

const KIND_LABEL: Record<InvoiceKind, string> = { acompte: "d'acompte", solde: 'de solde' }

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d)

export function toInvoice(doc: WithId<InvoiceRecord>): Invoice {
  const { _id, issuedAt, dueAt, payment, cancelledAt, lastReminderAt, ...rest } = doc
  return {
    ...rest,
    id: _id.toString(),
    issuedAt: iso(issuedAt),
    dueAt: iso(dueAt),
    payment: payment ? { ...payment, paidAt: iso(payment.paidAt) } : undefined,
    cancelledAt: cancelledAt ? iso(cancelledAt) : undefined,
    lastReminderAt: lastReminderAt ? iso(lastReminderAt) : undefined,
  }
}

// Sequential, gap-free numbering (FAC-2026-001, REC-2026-001): an atomic
// counter document per prefix and year rather than "count + 1", so two
// invoices issued at the same moment can never get the same number.
export async function nextSequence(prefix: 'FAC' | 'REC'): Promise<string> {
  const db = await getDb()
  const year = new Date().getFullYear()
  const doc = await db.collection<{ _id: string; seq: number }>('counters').findOneAndUpdate(
    { _id: `${prefix}-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  return `${prefix}-${year}-${String(doc?.seq ?? 1).padStart(3, '0')}`
}

let invoiceIndexes: Promise<unknown> | null = null

export async function invoicesCol() {
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

// The provider's current signature (stamped on every invoice and receipt).
export async function providerSignatureUrl(): Promise<string | undefined> {
  const portfolio = await fetchPortfolioSafe('billing-signature')
  return (portfolio?.personal ?? defaultPersonalInfo).signatureUrl || undefined
}

export async function pushQuoteEvent(quoteNumero: string, event: QuoteRecordEvent) {
  const col = await quotesCol()
  await col.updateOne({ numero: quoteNumero }, { $push: { events: event } })
}

// Emails the invoice (or its receipt) with the PDF. Never throws; returns
// whether it went out. `record: false` = don't leave a failure record (admin
// retries report the outcome themselves).
export async function sendInvoiceMail(invoice: Invoice, document: 'facture' | 'recu', record = true): Promise<boolean> {
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

// Creates an invoice for an accepted quote, enforcing every business rule:
// deposit only if the terms have one, balance only after delivery and once the
// deposit is paid, at most one live invoice per kind. Does not send anything —
// the caller schedules `sendInvoiceMail` in whatever way suits its context.
export async function createInvoice(quoteId: string, kind: InvoiceKind): Promise<BillingResult> {
  if (kind !== 'acompte' && kind !== 'solde') return { ok: false, message: 'Type de facture invalide.' }

  const qcol = await quotesCol()
  const qdoc = await qcol.findOne({ _id: new ObjectId(quoteId) })
  if (!qdoc) return { ok: false, message: 'Devis introuvable.' }
  if ((qdoc.status ?? 'pending') !== 'accepted') {
    return { ok: false, message: "Le devis doit être accepté (signé) avant d'émettre une facture." }
  }
  const quote = toQuote(qdoc)
  const portfolio = await fetchPortfolioSafe('createInvoice')
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
    accessCode: qdoc.accessCode,
  }
  const { insertedId } = await col.insertOne(record)
  const invoice = toInvoice({ ...record, _id: insertedId })

  await pushQuoteEvent(quote.numero, { type: 'invoice_issued', at: issuedAt, meta: { numero, kind } })

  return {
    ok: true,
    invoice,
    message: invoice.client.email ? `Facture ${numero} émise et envoyée au client.` : `Facture ${numero} émise (le client n'a pas d'email : téléchargez-la pour la lui remettre).`,
  }
}
