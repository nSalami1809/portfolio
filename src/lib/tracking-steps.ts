// Pure computation behind the client "Suivre mon dossier" timeline: where a
// project stands, derived only from its quote record and its invoices. Kept
// free of any I/O (and of `now`, passed in) so it can be unit-tested.
import type { Quote } from '@/actions/quotes'
import type { QuoteTerms } from '@/lib/business'
import { addBusinessDays, RECETTE_DAYS } from '@/lib/quote-document'

export type TrackKey = 'issued' | 'signed' | 'deposit' | 'build' | 'delivered' | 'acceptance' | 'balance' | 'warranty'
export type TrackState = 'done' | 'current' | 'pending' | 'blocked'

// Language-neutral: the page turns keys + data into sentences (fr/en).
export interface TrackStep {
  key: TrackKey
  state: TrackState
  at?: string
  data?: { outcome?: 'declined' | 'expired' | 'reserves' | 'clean' | 'issued' | 'paid' | 'deemed'; days?: number; until?: string }
}

export interface InvoiceProgress {
  status: 'issued' | 'paid' | 'cancelled'
  paidAt?: string
}

interface Input {
  quote: Pick<Quote, 'dateEmission' | 'status' | 'signature' | 'delivery' | 'acceptance' | 'extraDelayDays'>
  terms: Pick<QuoteTerms, 'depositPercent' | 'deliveryDays' | 'warrantyDays'>
  expired: boolean
  deposit?: InvoiceProgress
  balance?: InvoiceProgress
  now: number
}

type Draft = Omit<TrackStep, 'state'> & { done: boolean; blocked?: boolean }

export function computeTrackSteps({ quote, terms, expired, deposit, balance, now }: Input): TrackStep[] {
  const hasDeposit = terms.depositPercent > 0 && terms.depositPercent < 100
  const accepted = quote.status === 'accepted'
  const declined = quote.status === 'declined'
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
      at: deposit?.paidAt,
      data: { outcome: deposit ? (deposit.status === 'paid' ? 'paid' : 'issued') : undefined },
    })
  }
  drafts.push({ key: 'build', done: !!quote.delivery, data: { days: terms.deliveryDays + (quote.extraDelayDays ?? 0) } })
  drafts.push({ key: 'delivered', done: !!quote.delivery, at: quote.delivery?.deliveredAt })

  const deemedAt = quote.delivery ? addBusinessDays(quote.delivery.deliveredAt, RECETTE_DAYS) : undefined
  const deemed = !quote.acceptance && !!deemedAt && deemedAt.getTime() < now
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
    at: balance?.paidAt,
    data: { outcome: balance ? (balance.status === 'paid' ? 'paid' : 'issued') : undefined },
  })
  if (terms.warrantyDays > 0) {
    const end = quote.delivery ? new Date(new Date(quote.delivery.deliveredAt).getTime() + terms.warrantyDays * 86_400_000) : undefined
    drafts.push({
      key: 'warranty',
      done: !!end && end.getTime() < now,
      data: { days: terms.warrantyDays, until: end?.toISOString() },
    })
  }

  // Exactly one step is "current": the first one that is neither done nor
  // blocked (a declined/expired quote blocks everything after it).
  let currentTaken = false
  let stopped = false
  return drafts.map((d): TrackStep => {
    if (d.blocked) { stopped = true; return { key: d.key, state: 'blocked', at: d.at, data: d.data } }
    if (d.done) return { key: d.key, state: 'done', at: d.at, data: d.data }
    if (stopped || currentTaken) return { key: d.key, state: 'pending', at: d.at, data: d.data }
    currentTaken = true
    return { key: d.key, state: 'current', at: d.at, data: d.data }
  })
}
