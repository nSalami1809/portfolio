// The quotes pipeline: where each quote stands, and what the next move is. Pure rules
// over the facts already on the quote (events, signature, delivery, acceptance) and the
// reminders the admin marked as sent. No model, nothing written.
import { MIN_DAYS_BETWEEN_REMINDERS, type ReminderHistoryEntry } from '@/lib/assistant/reminders'

export type PipelineStage = 'sent' | 'viewed' | 'signed' | 'delivered' | 'accepted' | 'declined'

export const PIPELINE_STAGES: { stage: PipelineStage; label: string }[] = [
  { stage: 'sent', label: 'Envoyé' },
  { stage: 'viewed', label: 'Consulté' },
  { stage: 'signed', label: 'Signé' },
  { stage: 'delivered', label: 'Livré' },
  { stage: 'accepted', label: 'Recette signée' },
  { stage: 'declined', label: 'Refusé' },
]

/** What the pipeline needs from a quote (AdminQuote has all of it). */
export interface PipelineQuote {
  id: string
  numero: string
  clientNom: string
  totalTTC: number
  status?: 'pending' | 'accepted' | 'declined'
  kind?: 'devis' | 'avenant'
  dateEmission: string
  validiteJours: number
  signature?: unknown
  delivery?: { deliveredAt: string }
  acceptance?: unknown
  events?: { type: string; at: string }[]
  testimonialRequestedAt?: string
}

const DAY = 86_400_000
const daysSince = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY))

export function stageOf(q: PipelineQuote): PipelineStage {
  if (q.status === 'declined') return 'declined'
  if (q.acceptance) return 'accepted'
  if (q.delivery) return 'delivered'
  if (q.signature || q.status === 'accepted') return 'signed'
  if (q.events?.some((e) => e.type === 'viewed')) return 'viewed'
  return 'sent'
}

export type ActionKey = 'remind' | 'wait' | 'expired' | 'collect' | 'in_progress' | 'await_acceptance' | 'review' | 'done'
export type ActionTone = 'todo' | 'info' | 'late' | 'done'

export interface NextAction {
  key: ActionKey
  label: string
  tone: ActionTone
}

export interface PipelineContext {
  now: Date
  /** Quote numbers that still have an unpaid invoice. */
  unpaid: Set<string>
  /** Reminders marked as sent, per quote number. */
  reminders: Map<string, ReminderHistoryEntry> | Record<string, ReminderHistoryEntry>
}

const remindersOf = (ctx: PipelineContext, numero: string): ReminderHistoryEntry | undefined =>
  ctx.reminders instanceof Map ? ctx.reminders.get(numero) : ctx.reminders[numero]

export function nextAction(q: PipelineQuote, ctx: PipelineContext): NextAction {
  const stage = stageOf(q)
  const { now } = ctx
  const waiting = daysSince(q.dateEmission, now)

  if (stage === 'declined') return { key: 'done', label: 'Refusé par le client', tone: 'done' }
  if (stage === 'accepted') {
    return q.testimonialRequestedAt
      ? { key: 'done', label: 'Terminé', tone: 'done' }
      : { key: 'review', label: 'Demander un avis au client', tone: 'todo' }
  }
  if (stage === 'delivered') {
    const since = q.delivery ? daysSince(q.delivery.deliveredAt, now) : 0
    return since >= 7
      ? { key: 'await_acceptance', label: `Recette : ${since} j sans retour (réputée acceptée)`, tone: 'late' }
      : { key: 'await_acceptance', label: `Recette attendue (livré il y a ${since} j)`, tone: 'info' }
  }
  if (stage === 'signed') {
    return ctx.unpaid.has(q.numero)
      ? { key: 'collect', label: 'Facture à encaisser', tone: 'todo' }
      : { key: 'in_progress', label: 'Projet en cours', tone: 'info' }
  }

  // sent or viewed: waiting for the client's answer
  const expired = new Date(q.dateEmission).getTime() + q.validiteJours * DAY < now.getTime()
  if (expired) return { key: 'expired', label: 'Devis expiré : réactualiser ou clôturer', tone: 'late' }
  const h = remindersOf(ctx, q.numero)
  const sinceReminder = h?.lastAt ? daysSince(h.lastAt, now) : null
  const reminded = sinceReminder === null ? '' : ` · relancé il y a ${sinceReminder} j`
  const due = waiting >= 7 && (sinceReminder === null || sinceReminder >= 7)
  if (due) return { key: 'remind', label: `Relancer : ${waiting} j sans réponse${sinceReminder === null ? ', jamais relancé' : reminded}`, tone: 'todo' }
  if (sinceReminder !== null && sinceReminder < MIN_DAYS_BETWEEN_REMINDERS) return { key: 'wait', label: `Relancé il y a ${sinceReminder} j : laisser le temps`, tone: 'info' }
  return { key: 'wait', label: `En attente depuis ${waiting} j${reminded}`, tone: 'info' }
}

export interface PipelineCard<Q extends PipelineQuote = PipelineQuote> {
  quote: Q
  action: NextAction
}

export interface PipelineColumn<Q extends PipelineQuote = PipelineQuote> {
  stage: PipelineStage
  label: string
  cards: PipelineCard<Q>[]
  totalTTC: number
}

const TONE_ORDER: Record<ActionTone, number> = { late: 0, todo: 1, info: 2, done: 3 }

/** Columns in order; inside a column, what needs attention first, then oldest first. */
export function buildPipeline<Q extends PipelineQuote>(quotes: Q[], ctx: PipelineContext): PipelineColumn<Q>[] {
  const cards = quotes.map((quote) => ({ quote, action: nextAction(quote, ctx) }))
  return PIPELINE_STAGES.map(({ stage, label }) => {
    const inStage = cards
      .filter((c) => stageOf(c.quote) === stage)
      .sort((a, b) => TONE_ORDER[a.action.tone] - TONE_ORDER[b.action.tone] || new Date(a.quote.dateEmission).getTime() - new Date(b.quote.dateEmission).getTime())
    return { stage, label, cards: inStage, totalTTC: inStage.reduce((n, c) => n + c.quote.totalTTC, 0) }
  })
}

/** Quotes that need a move today, across all columns. */
export const attentionCount = (columns: PipelineColumn<PipelineQuote>[]): number =>
  columns.reduce((n, col) => n + col.cards.filter((c) => c.action.tone === 'todo' || c.action.tone === 'late').length, 0)
