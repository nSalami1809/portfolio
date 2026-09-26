'use server'

import { getDb } from '@/lib/mongodb'
import { defaultPersonalInfo } from '@/data/defaultData'
import { resolveTerms } from '@/lib/business'
import { computeTrackSteps, type TrackStep } from '@/lib/tracking-steps'
import { quotesCol, toQuote, checkRateLimit, isExpired } from '@/lib/quotes-core'

const TRACK_RATE_LIMIT_PER_HOUR = 30

export interface ProjectTracking {
  numero: string
  kind: 'devis' | 'avenant'
  clientNom: string
  totalTTC: number
  steps: TrackStep[]
  // Private links, only present when the step they lead to is actually open.
  links: { signPath?: string; pvPath?: string; documentPath: string }
  avenants: { numero: string; code: string; status: 'pending' | 'accepted' | 'declined'; totalTTC: number }[]
  // Changes asked so far against the revisions included in the contract.
  // `open`: the project is signed and its recette is not, so a new request is accepted.
  revisions: { used: number; included: number; open: boolean; requests: { at: string; note: string }[] }
  // Files the client sent (names only). `open`: the project is signed.
  files: { open: boolean; items: { name: string; size: number; at: string }[] }
}

export type TrackingResult = { ok: true; tracking: ProjectTracking } | { ok: false; error: string }

interface InvoiceRow {
  kind: 'acompte' | 'solde'
  status: 'issued' | 'paid' | 'cancelled'
  payment?: { paidAt: Date }
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d)

// Public: where is my project? Keyed on the private access code the client was
// given (never the guessable numero), rate-limited. Exposes progress and the
// private links to whichever document is waiting for the client — nothing
// about the provider's side (no amounts other than the quote total, no invoice
// numbers).
export async function getProjectTracking(code: string, locale: string): Promise<TrackingResult> {
  if (typeof code !== 'string') return { ok: false, error: 'invalid' }
  const ref = code.trim().toUpperCase()
  if (ref.length < 4 || ref.length > 20) return { ok: false, error: 'invalid' }
  if (!(await checkRateLimit('track-project', TRACK_RATE_LIMIT_PER_HOUR))) return { ok: false, error: 'rate' }

  const col = await quotesCol()
  const doc = await col.findOne({ accessCode: ref })
  if (!doc) return { ok: false, error: 'notfound' }
  const quote = toQuote(doc)
  const terms = resolveTerms(quote, defaultPersonalInfo)
  const lang = locale === 'en' ? 'en' : 'fr'

  const db = await getDb()
  const invoices = await db.collection<InvoiceRow>('invoices').find({ quoteNumero: quote.numero, status: { $ne: 'cancelled' } }).toArray()
  const deposit = invoices.find((i) => i.kind === 'acompte')
  const balance = invoices.find((i) => i.kind === 'solde')

  const expired = quote.status === 'pending' && isExpired({ dateEmission: new Date(quote.dateEmission), validiteJours: quote.validiteJours })
  const progress = (inv?: InvoiceRow) => inv ? { status: inv.status, paidAt: inv.payment ? iso(inv.payment.paidAt) : undefined } : undefined
  const steps = computeTrackSteps({ quote, terms, expired, deposit: progress(deposit), balance: progress(balance), now: Date.now() })

  const avenantDocs = quote.kind === 'devis'
    ? await col.find({ parentNumero: quote.numero }).sort({ createdAt: 1 }).toArray()
    : []

  return {
    ok: true,
    tracking: {
      numero: quote.numero,
      kind: quote.kind,
      clientNom: quote.clientNom,
      totalTTC: quote.totalTTC,
      steps,
      links: {
        documentPath: `/${lang}/devis?ref=${encodeURIComponent(quote.accessCode)}`,
        ...(quote.status === 'pending' && !expired && quote.signToken ? { signPath: `/${lang}/devis/signature/${quote.signToken}` } : {}),
        ...(doc.delivery?.token && !quote.acceptance ? { pvPath: `/${lang}/recette/${doc.delivery.token}` } : {}),
      },
      avenants: avenantDocs.map((a) => ({ numero: a.numero, code: a.accessCode, status: a.status ?? 'pending', totalTTC: a.totalTTC })),
      revisions: {
        used: doc.revisions?.length ?? 0,
        included: terms.includedRevisions,
        open: quote.status === 'accepted' && !!doc.signature && !doc.acceptance,
        requests: (doc.revisions ?? []).map((r) => ({ at: iso(r.at), note: r.note })),
      },
      files: {
        open: quote.status === 'accepted' && !!doc.signature,
        items: (doc.files ?? []).map((f) => ({ name: f.name, size: f.size, at: iso(f.at) })),
      },
    },
  }
}
