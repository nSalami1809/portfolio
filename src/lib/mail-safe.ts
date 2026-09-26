// Outgoing mail for the quote / invoice flow, with a failure trail.
//
// These emails go out from `after()` callbacks: once the request has answered,
// nobody is waiting on them, so a failure used to vanish into a server log
// while the client waited for a devis, a facture or a procès-verbal that never
// arrived. Every send now either succeeds or leaves a record in `mail_failures`
// that the admin sees (bell + /admin/emails) and can retry.
import type { SendMailOptions } from 'nodemailer'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { getAdminEmail } from '@/lib/admin-config'

// What the email was for — decides how it can be retried.
export type MailKind = 'devis' | 'contrat' | 'pv' | 'facture' | 'recu' | 'admin'

export interface MailContext {
  kind: MailKind
  quoteId?: string
  invoiceId?: string
}

export interface MailFailure {
  kind: MailKind
  quoteId?: string
  invoiceId?: string
  to: string
  subject: string
  error: string
  createdAt: Date
  resolved: boolean
}

// E2E_DRY_RUN=1: nothing is sent; the message (without attachment bytes) is
// written to `mail_dry_run` instead — used by the end-to-end test harness, so a
// full run never emails a real person.
const isDryRun = () => process.env.E2E_DRY_RUN === '1'

export async function sendMailLogged(message: SendMailOptions, ctx: MailContext, opts: { record?: boolean } = {}): Promise<boolean> {
  const record = opts.record ?? true
  const to = String(message.to ?? '')
  const subject = String(message.subject ?? '')

  if (isDryRun()) {
    const db = await getDb()
    await db.collection('mail_dry_run').insertOne({
      kind: ctx.kind, quoteId: ctx.quoteId, invoiceId: ctx.invoiceId, to, subject, html: String(message.html ?? ''),
      attachments: (Array.isArray(message.attachments) ? message.attachments : []).map((a) => ({
        filename: a.filename, bytes: Buffer.isBuffer(a.content) ? a.content.length : 0,
      })),
      createdAt: new Date(),
    })
    return true
  }

  try {
    await getTransporter().sendMail(message)
    return true
  } catch (e) {
    console.error(`[mail] ${ctx.kind} to ${to} failed:`, e)
    if (record) {
      try {
        const adminEmail = await getAdminEmail()
        const db = await getDb()
        void db.collection('mail_failures').createIndex({ resolved: 1, createdAt: -1 }).catch(() => {})
        await db.collection<MailFailure>('mail_failures').insertOne({
          // An email to the admin themselves cannot be "retried for the client".
          kind: to === adminEmail ? 'admin' : ctx.kind,
          quoteId: ctx.quoteId,
          invoiceId: ctx.invoiceId,
          to, subject,
          error: e instanceof Error ? e.message.slice(0, 300) : 'Erreur inconnue',
          createdAt: new Date(),
          resolved: false,
        })
      } catch (logError) {
        console.error('[mail] could not record the failure:', logError)
      }
    }
    return false
  }
}

// Drop-in replacement for a nodemailer transporter at a call site:
// `const transporter = loggedMailer({ kind: 'devis', quoteId })` and the
// existing `transporter.sendMail({...})` calls keep working, now logged.
export function loggedMailer(ctx: MailContext, opts: { record?: boolean } = {}) {
  return { sendMail: (message: SendMailOptions) => sendMailLogged(message, ctx, opts) }
}
