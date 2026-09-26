'use server'

import { ObjectId } from 'mongodb'
import { after } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import {
  createInvoice, invoicesCol, nextSequence, providerSignatureUrl, pushQuoteEvent, sendInvoiceMail, toInvoice,
  type BillingResult, type Invoice, type InvoiceKind,
} from '@/lib/invoicing'
import { SITE_URL } from '@/lib/quotes-core'

// Admin retry of a failed invoice / receipt email: awaited (unlike the
// background send after issuing), so the admin learns the real outcome.
export async function retryInvoiceEmail(invoiceId: string, document: 'facture' | 'recu'): Promise<boolean> {
  await requireAdmin()
  const col = await invoicesCol()
  const doc = await col.findOne({ _id: new ObjectId(invoiceId) })
  if (!doc) return false
  return sendInvoiceMail(toInvoice(doc), document, false)
}

export async function listInvoices(): Promise<Invoice[]> {
  await requireAdmin()
  const col = await invoicesCol()
  const docs = await col.find({}).sort({ issuedAt: -1 }).limit(500).toArray()
  return docs.map(toInvoice)
}

export async function issueInvoice(quoteId: string, kind: InvoiceKind): Promise<BillingResult> {
  await requireAdmin()
  const result = await createInvoice(quoteId, kind)
  if (result.ok && result.invoice) {
    const invoice = result.invoice
    after(() => sendInvoiceMail(invoice, 'facture'))
  }
  return result
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
