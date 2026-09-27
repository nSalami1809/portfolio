// Daily run of the automatic reminders (see api/cron/reminders): loads what
// could need a nudge, asks the planner (lib/reminders.ts) what is due, sends,
// and leaves a trace. Every reminder is *claimed* in the database before it is
// sent, so two overlapping runs can never email the same client twice; if the
// send fails the claim is released and the next run tries again.
import type { Filter, WithId } from 'mongodb'
import { sendMailLogged } from '@/lib/mail-safe'
import { getAdminEmail } from '@/lib/admin-config'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { resolveTerms, wantsReminders } from '@/lib/business'
import { quotesCol, SITE_URL, type QuoteRecord, type QuoteRecordEvent } from '@/lib/quotes-core'
import { invoicesCol, toInvoice, providerSignatureUrl, type InvoiceRecord } from '@/lib/invoicing'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { RECETTE_DAYS } from '@/lib/quote-document'
import { quoteExpiringEmail, invoiceOverdueEmail, recetteReminderEmail, recetteDeemedEmail, testimonialRequestEmail } from '@/lib/email-client'
import { remindersDigestEmail } from '@/lib/email-templates'
import { planReminders, type OneOffReminder, type PlanInvoice, type PlanQuote, type ReminderAction } from '@/lib/reminders'
import { notifyAdmin } from '@/lib/push'

const DAY = 86_400_000

export interface RemindersReport {
  enabled: boolean
  planned: number
  sent: string[]
  failed: string[]
}

type QuoteDoc = WithId<QuoteRecord>

const ONE_OFF_KEY: Record<'quote_expiring' | 'recette_reminder' | 'recette_deemed' | 'warranty_end', OneOffReminder> = {
  quote_expiring: 'expiring',
  recette_reminder: 'recette',
  recette_deemed: 'deemed',
  warranty_end: 'warranty',
}

export async function runReminders(now = new Date()): Promise<RemindersReport> {
  const portfolio = await fetchPortfolioSafe('reminders')
  const personal = portfolio?.personal ?? defaultPersonalInfo
  const report: RemindersReport = { enabled: true, planned: 0, sent: [], failed: [] }
  if (!wantsReminders(resolveTerms({}, personal))) return { ...report, enabled: false }

  const qcol = await quotesCol()
  const icol = await invoicesCol()
  const [quoteDocs, invoiceDocs] = await Promise.all([
    qcol.find({ $or: [{ signature: { $exists: false }, status: { $ne: 'declined' } }, { delivery: { $exists: true } }] }).toArray(),
    icol.find({ status: 'issued' }).toArray(),
  ])
  const quoteById = new Map(quoteDocs.map((d) => [d._id.toString(), d]))
  const invoiceById = new Map(invoiceDocs.map((d) => [d._id.toString(), d]))
  const unpaid = new Set(invoiceDocs.map((i) => i.quoteNumero))

  const planQuotes: PlanQuote[] = quoteDocs.map((d) => ({
    id: d._id.toString(),
    numero: d.numero,
    status: d.status ?? 'pending',
    hasClientEmail: !!d.clientEmail,
    signed: !!d.signature,
    dateEmission: d.dateEmission,
    validiteJours: d.validiteJours,
    deliveredAt: d.delivery?.deliveredAt,
    accepted: !!d.acceptance,
    warrantyDays: resolveTerms(d, personal).warrantyDays,
    testimonialRequested: !!d.testimonialRequestedAt,
    hasUnpaidInvoice: unpaid.has(d.numero),
    sent: d.remindersSent ?? {},
  }))
  const planInvoices: PlanInvoice[] = invoiceDocs.map((d) => ({
    id: d._id.toString(),
    numero: d.numero,
    status: d.status,
    hasClientEmail: !!d.client.email,
    dueAt: d.dueAt,
    reminderCount: d.reminderCount ?? 0,
    lastReminderAt: d.lastReminderAt,
  }))

  const actions = planReminders({ quotes: planQuotes, invoices: planInvoices, now })
  report.planned = actions.length
  if (actions.length === 0) return report

  const adminEmail = await getAdminEmail()
  const lines: string[] = []

  for (const action of actions) {
    try {
      const line = action.type === 'invoice_overdue'
        ? await sendOverdue(action, invoiceById.get(action.invoiceId)!, adminEmail, now)
        : await sendQuoteReminder(action, quoteById.get(action.quoteId)!, personal.name, adminEmail, now, resolveTerms(quoteById.get(action.quoteId)!, personal).warrantyDays)
      if (line) { lines.push(line); report.sent.push(line) }
    } catch (e) {
      console.error('[reminders]', action.type, e)
      report.failed.push(`${action.type} ${action.numero}`)
    }
  }

  if (lines.length) {
    const digest = remindersDigestEmail(lines)
    await sendMailLogged({ from: `"Portfolio NS · Relances" <${process.env.GMAIL_USER}>`, to: adminEmail, subject: digest.subject, html: digest.html }, { kind: 'admin' })
    await notifyAdmin({ title: 'Relances automatiques', body: lines.join('\n'), url: '/admin/quotes' })
  }
  return report
}

// ── Quote-side reminders ─────────────────────────────────────────────────────

async function sendQuoteReminder(
  action: Exclude<ReminderAction, { type: 'invoice_overdue' }>,
  doc: QuoteDoc,
  providerName: string,
  adminEmail: string,
  now: Date,
  warrantyDays: number,
): Promise<string | null> {
  const col = await quotesCol()
  const key = ONE_OFF_KEY[action.type]
  const claim = await col.updateOne({ _id: doc._id, [`remindersSent.${key}`]: { $exists: false } }, { $set: { [`remindersSent.${key}`]: now } })
  if (claim.matchedCount === 0) return null

  const release = () => col.updateOne({ _id: doc._id }, { $unset: { [`remindersSent.${key}`]: '' } })
  const from = `"${doc.terms?.provider.name ?? providerName}" <${process.env.GMAIL_USER}>`
  const to = doc.clientEmail
  const ctx = { quoteId: doc._id.toString() }
  const event = (type: QuoteRecordEvent['type'], meta: Record<string, string>) =>
    col.updateOne({ _id: doc._id }, { $push: { events: { type, at: now, meta } } })

  let mail: { subject: string; html: string } | null = null
  let line = ''
  let kind: 'devis' | 'pv' = 'devis'

  switch (action.type) {
    case 'quote_expiring': {
      mail = quoteExpiringEmail({ accessCode: doc.accessCode, numero: doc.numero, signToken: doc.signToken, clientNom: doc.clientNom, kind: doc.kind, locale: doc.locale, expiresAt: action.expiresAt.toISOString(), daysLeft: action.daysLeft }, adminEmail)
      line = `Devis ${doc.numero} : rappel d'expiration envoyé à ${doc.clientNom} (${action.daysLeft} j restants)`
      break
    }
    case 'recette_reminder': {
      if (!doc.delivery) return (await release(), null)
      kind = 'pv'
      mail = recetteReminderEmail({ accessCode: doc.accessCode, numero: doc.numero, deliveryToken: doc.delivery.token, clientNom: doc.clientNom, locale: doc.locale, deemedAt: action.deemedAt.toISOString() }, adminEmail)
      line = `Recette ${doc.numero} : rappel envoyé à ${doc.clientNom} avant acceptation tacite`
      break
    }
    case 'recette_deemed': {
      if (!doc.delivery) return (await release(), null)
      kind = 'pv'
      if (to) {
        const warrantyEnd = new Date(doc.delivery.deliveredAt.getTime() + warrantyDays * DAY)
        mail = recetteDeemedEmail({ accessCode: doc.accessCode, numero: doc.numero, clientNom: doc.clientNom, locale: doc.locale, warrantyDays, warrantyEnd: warrantyEnd.toISOString() }, adminEmail)
      }
      line = `Recette ${doc.numero} : réputée acceptée (aucun retour de ${doc.clientNom} sous ${RECETTE_DAYS} jours ouvrés)`
      break
    }
    case 'warranty_end': {
      mail = testimonialRequestEmail({ accessCode: doc.accessCode, clientNom: doc.clientNom, numero: doc.numero, locale: doc.locale }, adminEmail)
      line = `Devis ${doc.numero} : garantie terminée, demande d'avis envoyée à ${doc.clientNom}`
      break
    }
  }

  if (mail && to) {
    const ok = await sendMailLogged({ from, to, subject: mail.subject, html: mail.html }, { kind, ...ctx })
    if (!ok) { await release(); throw new Error(`mail to ${to} failed`) }
  }
  if (action.type === 'warranty_end') await col.updateOne({ _id: doc._id }, { $set: { testimonialRequestedAt: now } })
  await event(action.type === 'recette_deemed' ? 'delivery_deemed' : 'reminder_sent', { reminder: key })
  return line
}

// ── Invoice-side reminder ────────────────────────────────────────────────────

async function sendOverdue(
  action: Extract<ReminderAction, { type: 'invoice_overdue' }>,
  doc: WithId<InvoiceRecord>,
  adminEmail: string,
  now: Date,
): Promise<string | null> {
  const col = await invoicesCol()
  const count = doc.reminderCount ?? 0
  const sameCount: Filter<InvoiceRecord> = count === 0 ? { $or: [{ reminderCount: 0 }, { reminderCount: { $exists: false } }] } : { reminderCount: count }
  const claim = await col.updateOne({ _id: doc._id, status: 'issued', ...sameCount }, { $set: { lastReminderAt: now }, $inc: { reminderCount: 1 } })
  if (claim.matchedCount === 0) return null

  try {
    const invoice = toInvoice(doc)
    const mail = invoiceOverdueEmail({ ...invoice, reminderNumber: action.reminderNumber, latePenaltyRate: invoice.terms.latePenaltyRate }, adminEmail)
    const content = await generateInvoicePdf({ invoice, document: 'facture', siteUrl: SITE_URL, signatureUrl: await providerSignatureUrl() })
    const ok = await sendMailLogged({
      from: `"${invoice.terms.provider.name}" <${process.env.GMAIL_USER}>`,
      to: invoice.client.email!,
      subject: mail.subject,
      html: mail.html,
      attachments: [{ filename: `Facture-${invoice.numero}.pdf`, content, contentType: 'application/pdf' }],
    }, { kind: 'facture', invoiceId: invoice.id })
    if (!ok) throw new Error('mail failed')
  } catch (e) {
    await col.updateOne({ _id: doc._id }, doc.lastReminderAt
      ? { $inc: { reminderCount: -1 }, $set: { lastReminderAt: doc.lastReminderAt } }
      : { $inc: { reminderCount: -1 }, $unset: { lastReminderAt: '' } })
    throw e
  }

  const qcol = await quotesCol()
  await qcol.updateOne({ numero: doc.quoteNumero }, { $push: { events: { type: 'reminder_sent', at: now, meta: { reminder: 'invoice_overdue', numero: doc.numero, n: String(action.reminderNumber) } } } })
  return `Facture ${doc.numero} : rappel n°${action.reminderNumber} envoyé à ${doc.client.nom}`
}
