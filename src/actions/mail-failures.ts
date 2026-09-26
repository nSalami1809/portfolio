'use server'

import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { requireAdmin } from '@/lib/require-admin'
import { getAdminEmail } from '@/lib/admin-config'
import { defaultPersonalInfo } from '@/data/defaultData'
import { sendMailLogged, type MailFailure, type MailKind } from '@/lib/mail-safe'
import { quoteClientCopyEmail, quoteSignedClientEmail, quoteAcceptedEmail, deliveryEmail, acceptanceSignedClientEmail } from '@/lib/email-client'
import { quotesCol, toQuote, withSignToken, buildQuoteAttachment } from '@/lib/quotes-core'
import { retryInvoiceEmail } from '@/actions/billing'

export interface AdminMailFailure {
  id: string
  kind: MailKind
  quoteId?: string
  invoiceId?: string
  to: string
  subject: string
  error: string
  createdAt: string
  resolved: boolean
  // Can the client's copy be sent again from here?
  retryable: boolean
}

async function failures() {
  const db = await getDb()
  return db.collection<MailFailure>('mail_failures')
}

export async function listMailFailures(): Promise<AdminMailFailure[]> {
  await requireAdmin()
  const col = await failures()
  const docs = await col.find({}).sort({ resolved: 1, createdAt: -1 }).limit(100).toArray()
  return docs.map((d) => ({
    id: d._id.toString(),
    kind: d.kind, quoteId: d.quoteId, invoiceId: d.invoiceId, to: d.to, subject: d.subject, error: d.error,
    createdAt: d.createdAt.toISOString(),
    resolved: d.resolved,
    retryable: d.kind !== 'admin' && !!(d.quoteId || d.invoiceId),
  }))
}

export async function resolveMailFailure(id: string): Promise<void> {
  await requireAdmin()
  const col = await failures()
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { resolved: true } })
}

// Sends the client's copy of a document again (devis, contrat, PV), awaited so
// the admin learns whether it really went through.
async function resendQuoteDocument(quoteId: string, kind: 'devis' | 'contrat' | 'pv'): Promise<{ ok: boolean; message: string }> {
  const col = await quotesCol()
  const raw = await col.findOne({ _id: new ObjectId(quoteId) })
  if (!raw) return { ok: false, message: 'Devis introuvable.' }
  if (!raw.clientEmail) return { ok: false, message: "Ce devis n'a pas d'email client." }
  const doc = await withSignToken(col, raw)
  const quote = toQuote(doc)
  const adminEmail = await getAdminEmail()
  const from = `"${quote.terms?.provider.name ?? defaultPersonalInfo.name}" <${process.env.GMAIL_USER}>`

  let mail: { subject: string; html: string }
  let variant: 'devis' | 'contrat' | 'pv'
  if (kind === 'pv') {
    if (!doc.delivery?.token) return { ok: false, message: "Ce projet n'est pas encore livré." }
    const data = { ...quote, deliveryToken: doc.delivery.token }
    mail = quote.acceptance ? acceptanceSignedClientEmail(data, adminEmail) : deliveryEmail(data, adminEmail)
    variant = 'pv'
  } else if (kind === 'contrat') {
    mail = quote.signature ? quoteSignedClientEmail(quote, adminEmail) : quoteAcceptedEmail(quote, adminEmail)
    variant = 'contrat'
  } else {
    mail = quoteClientCopyEmail({ ...quote, signToken: quote.signToken! }, adminEmail)
    variant = quote.status === 'accepted' ? 'contrat' : 'devis'
  }

  const attachments = await buildQuoteAttachment(quote, variant)
  const sent = await sendMailLogged({ from, to: raw.clientEmail, subject: mail.subject, html: mail.html, attachments }, { kind, quoteId }, { record: false })
  return sent ? { ok: true, message: 'Email renvoyé au client.' } : { ok: false, message: "L'envoi a de nouveau échoué." }
}

export async function retryMailFailure(id: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin()
  const col = await failures()
  const failure = await col.findOne({ _id: new ObjectId(id) })
  if (!failure) return { ok: false, message: 'Entrée introuvable.' }

  let result: { ok: boolean; message: string }
  if ((failure.kind === 'facture' || failure.kind === 'recu') && failure.invoiceId) {
    const sent = await retryInvoiceEmail(failure.invoiceId, failure.kind)
    result = sent ? { ok: true, message: 'Email renvoyé au client.' } : { ok: false, message: "L'envoi a de nouveau échoué." }
  } else if ((failure.kind === 'devis' || failure.kind === 'contrat' || failure.kind === 'pv') && failure.quoteId) {
    result = await resendQuoteDocument(failure.quoteId, failure.kind)
  } else {
    return { ok: false, message: 'Cet email ne peut pas être renvoyé automatiquement.' }
  }

  if (result.ok) await col.updateOne({ _id: failure._id }, { $set: { resolved: true } })
  return result
}
