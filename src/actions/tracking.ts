'use server'

import { getDb } from '@/lib/mongodb'
import { defaultPersonalInfo } from '@/data/defaultData'
import { resolveTerms } from '@/lib/business'
import { addBusinessDays, RECETTE_DAYS } from '@/lib/quote-document'
import { quotesCol, toQuote, checkRateLimit, isExpired } from '@/lib/quotes-core'

const TRACK_RATE_LIMIT_PER_HOUR = 30

export type TrackKey = 'issued' | 'signed' | 'deposit' | 'build' | 'delivered' | 'acceptance' | 'balance' | 'warranty'
export type TrackState = 'done' | 'current' | 'pending' | 'blocked'

// Language-neutral: the page turns keys + data into sentences (fr/en).
export interface TrackStep {
  key: TrackKey
  state: TrackState
  at?: string
  data?: { outcome?: 'declined' | 'expired' | 'reserves' | 'clean' | 'issued' | 'paid' | 'deemed'; days?: number; until?: string }
}

export interface ProjectTracking {
  numero: string
  kind: 'devis' | 'avenant'
  clientNom: string
  totalTTC: number
  steps: TrackStep[]
  // Private links, only present when the step they lead to is actually open.
  links: { signPath?: string; pvPath?: string; documentPath: string }
  avenants: { numero: string; code: string; status: 'pending' | 'accepted' | 'declined'; totalTTC: number }[]
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
  const hasDeposit = terms.depositPercent > 0 && terms.depositPercent < 100
  const lang = locale === 'en' ? 'en' : 'fr'

  const db = await getDb()
  const invoices = await db.collection<InvoiceRow>('invoices').find({ quoteNumero: quote.numero, status: { $ne: 'cancelled' } }).toArray()
  const deposit = invoices.find((i) => i.kind === 'acompte')
  const balance = invoices.find((i) => i.kind === 'solde')

  const accepted = quote.status === 'accepted'
  const declined = quote.status === 'declined'
  const expired = !accepted && !declined && isExpired({ dateEmission: new Date(quote.dateEmission), validiteJours: quote.validiteJours })

  type Draft = Omit<TrackStep, 'state'> & { done: boolean; blocked?: boolean }
  const drafts: Draft[] = []

  drafts.push({ key: 'issued', done: true, at: quote.dateEmission })
  drafts.push({
    key: 'signed',
    done: accepted,
    blocked: declined || expired,
    at: quote.signature?.signedAt,
    data: declined ? { outcome: 'declined' } : expired ? { outcome: 'expired' } : undefined,
  })
  if (hasDeposit) {
    drafts.push({
      key: 'deposit',
      done: deposit?.status === 'paid',
      at: deposit?.payment ? iso(deposit.payment.paidAt) : undefined,
      data: { outcome: deposit ? (deposit.status === 'paid' ? 'paid' : 'issued') : undefined },
    })
  }
  drafts.push({ key: 'build', done: !!quote.delivery, data: { days: terms.deliveryDays + (quote.extraDelayDays ?? 0) } })
  drafts.push({ key: 'delivered', done: !!quote.delivery, at: quote.delivery?.deliveredAt })

  const deemedAt = quote.delivery ? addBusinessDays(quote.delivery.deliveredAt, RECETTE_DAYS) : undefined
  const deemed = !quote.acceptance && !!deemedAt && deemedAt.getTime() < Date.now()
  drafts.push({
    key: 'acceptance',
    done: !!quote.acceptance || deemed,
    at: quote.acceptance?.signedAt ?? (deemed ? deemedAt!.toISOString() : undefined),
    data: quote.acceptance
      ? { outcome: quote.acceptance.reserves ? 'reserves' : 'clean' }
      : deemed
        ? { outcome: 'deemed' }
        : deemedAt ? { until: deemedAt.toISOString() } : undefined,
  })
  drafts.push({
    key: 'balance',
    done: balance?.status === 'paid',
    at: balance?.payment ? iso(balance.payment.paidAt) : undefined,
    data: { outcome: balance ? (balance.status === 'paid' ? 'paid' : 'issued') : undefined },
  })
  if (terms.warrantyDays > 0) {
    const end = quote.delivery ? new Date(new Date(quote.delivery.deliveredAt).getTime() + terms.warrantyDays * 86_400_000) : undefined
    drafts.push({
      key: 'warranty',
      done: !!end && end.getTime() < Date.now(),
      data: { days: terms.warrantyDays, until: end?.toISOString() },
    })
  }

  // Exactly one step is "current": the first one that is neither done nor
  // blocked (a declined/expired quote blocks everything after it).
  let currentTaken = false
  let stopped = false
  const steps: TrackStep[] = drafts.map((d) => {
    if (d.blocked) { stopped = true; return { key: d.key, state: 'blocked', at: d.at, data: d.data } }
    if (d.done) return { key: d.key, state: 'done', at: d.at, data: d.data }
    if (stopped || currentTaken) return { key: d.key, state: 'pending', at: d.at, data: d.data }
    currentTaken = true
    return { key: d.key, state: 'current', at: d.at, data: d.data }
  })

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
    },
  }
}
