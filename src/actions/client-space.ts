'use server'

import { defaultPersonalInfo } from '@/data/defaultData'
import { resolveTerms } from '@/lib/business'
import { getAdminEmail } from '@/lib/admin-config'
import { sendMailLogged } from '@/lib/mail-safe'
import { clientActivityAdminEmail } from '@/lib/email-templates'
import { notifyAdmin } from '@/lib/push'
import { quotesCol, checkRateLimit, type QuoteRecordEvent } from '@/lib/quotes-core'
import { after } from 'next/server'

const REVISION_RATE_LIMIT_PER_HOUR = 10
const MIN_NOTE = 10
const MAX_NOTE = 1000
const MAX_REVISIONS_STORED = 100

export type RevisionResult =
  | { ok: true; used: number; included: number }
  | { ok: false; error: 'invalid' | 'rate' | 'notfound' | 'closed' | 'short' }

// Public: the client, identified by their tracking code, asks for a change.
// Only for a signed project whose recette is not signed yet; it is counted
// against the revisions included in the contract, and the provider is alerted.
export async function requestRevision(code: string, note: string): Promise<RevisionResult> {
  if (typeof code !== 'string' || typeof note !== 'string') return { ok: false, error: 'invalid' }
  const ref = code.trim().toUpperCase()
  const text = note.trim().slice(0, MAX_NOTE)
  if (ref.length < 4 || ref.length > 20) return { ok: false, error: 'invalid' }
  if (text.length < MIN_NOTE) return { ok: false, error: 'short' }
  if (!(await checkRateLimit('client-revision', REVISION_RATE_LIMIT_PER_HOUR))) return { ok: false, error: 'rate' }

  const col = await quotesCol()
  const doc = await col.findOne({ accessCode: ref })
  if (!doc) return { ok: false, error: 'notfound' }
  if (doc.status !== 'accepted' || !doc.signature || doc.acceptance) return { ok: false, error: 'closed' }
  if ((doc.revisions?.length ?? 0) >= MAX_REVISIONS_STORED) return { ok: false, error: 'closed' }

  const included = resolveTerms(doc, defaultPersonalInfo).includedRevisions
  const at = new Date()
  const used = (doc.revisions?.length ?? 0) + 1
  const event: QuoteRecordEvent = { type: 'revision_requested', at, meta: { source: 'client', n: String(used), of: String(included) } }
  await col.updateOne({ _id: doc._id }, { $push: { revisions: { at, note: text, source: 'client' }, events: event } })

  after(async () => {
    try {
      const mail = clientActivityAdminEmail({ numero: doc.numero, clientNom: doc.clientNom, kind: 'revision', text, used, included })
      await sendMailLogged({ from: `"Portfolio NS · Client" <${process.env.GMAIL_USER}>`, to: await getAdminEmail(), subject: mail.subject, html: mail.html }, { kind: 'admin', quoteId: doc._id.toString() })
      await notifyAdmin({ title: `${used > included ? 'Révision hors forfait' : 'Demande de modification'} — ${doc.numero}`, body: `${doc.clientNom} : ${text.slice(0, 120)}`, url: `/admin/quotes?q=${encodeURIComponent(doc.numero)}` })
    } catch (e) {
      console.error('[requestRevision] notify error:', e)
    }
  })

  return { ok: true, used, included }
}
