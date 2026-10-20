'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { prepareQuoteReminder } from '@/actions/assistant'
import { useToast } from '@/components/admin/Toast'
import { attentionCount, buildPipeline, type ActionTone, type PipelineQuote } from '@/lib/quote-pipeline'
import type { ReminderHistoryEntry } from '@/lib/assistant/reminders'

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`

const TONE_STYLE: Record<ActionTone, { border: string; color: string; background?: string }> = {
  late: { border: '#D90000', color: '#D90000' },
  todo: { border: 'var(--brand)', color: 'var(--text)', background: 'var(--brand-soft)' },
  info: { border: 'var(--border)', color: 'var(--text-muted)' },
  done: { border: 'var(--border)', color: 'var(--text-subtle)' },
}

interface Props<Q extends PipelineQuote> {
  quotes: Q[]
  unpaid: Set<string>
  reminders: Record<string, ReminderHistoryEntry>
  /** Opens the quote in the list view. */
  onOpen: (quote: Q) => void
}

// The quotes by stage, each with its next move. "Prepare the reminder" writes the draft
// by code (no model request) and opens it in the assistant: nothing is sent from here.
export default function QuotePipeline<Q extends PipelineQuote>({ quotes, unpaid, reminders, onOpen }: Props<Q>) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  // Computed once per render of the page: the clock only matters to the day.
  const [now] = useState(() => new Date())
  const columns = useMemo(() => buildPipeline(quotes, { now, unpaid, reminders }), [quotes, now, unpaid, reminders])
  const attention = attentionCount(columns)

  const remind = async (q: Q) => {
    setBusy(q.numero)
    try {
      const r = await prepareQuoteReminder(q.numero)
      if (!r.ok) { toast(r.error, 'error'); return }
      if (r.warning) toast(r.warning)
      if (!r.hasEmail) toast("Ce devis n'a pas d'adresse e-mail : le brouillon est prêt, mais contacte le client autrement.", 'error')
      router.push(`/admin/assistant?draft=${encodeURIComponent(r.draftId)}`)
    } catch {
      toast('Impossible de préparer la relance (erreur serveur).', 'error')
    } finally { setBusy(null) }
  }

  return (
    <div data-testid="quote-pipeline">
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }} data-testid="pipeline-summary">
        {attention > 0 ? `${attention} devis demande${attention > 1 ? 'nt' : ''} une action.` : 'Rien à faire sur les devis pour le moment.'} Aucun message n&apos;est envoyé d&apos;ici.
      </p>
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollSnapType: 'x proximity' }}>
        {columns.map((col) => (
          <section key={col.stage} aria-label={`${col.label}, ${col.cards.length} devis`} className="flex-shrink-0 w-64 sm:w-60" style={{ scrollSnapAlign: 'start' }} data-testid={`pipeline-col-${col.stage}`}>
            <header className="px-3 py-2 mb-2" style={{ borderBottom: '2px solid var(--brand)' }}>
              <h3 className="font-display font-semibold text-sm flex items-baseline justify-between gap-2" style={{ color: 'var(--text)' }}>
                <span>{col.label}</span>
                <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>{col.cards.length}</span>
              </h3>
              {col.cards.length > 0 && <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{fcfa(col.totalTTC)}</p>}
            </header>
            <div className="space-y-2">
              {col.cards.length === 0 && <p className="text-xs px-3 py-4" style={{ color: 'var(--text-subtle)', border: '1px dashed var(--border)' }}>Aucun devis à cette étape.</p>}
              {col.cards.map(({ quote, action }) => {
                const tone = TONE_STYLE[action.tone]
                return (
                  <article key={quote.id} className="card no-lift p-3" data-testid="pipeline-card">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{quote.clientNom}</p>
                    <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{quote.numero}{quote.kind === 'avenant' ? ' · avenant' : ''} · {fcfa(quote.totalTTC)}</p>
                    <p className="text-[11px] mt-2 px-2 py-1" data-tone={action.tone} style={{ border: `1px solid ${tone.border}`, color: tone.color, background: tone.background }}>{action.label}</p>
                    <div className="flex gap-1.5 mt-2">
                      {action.key === 'remind' && (
                        <button type="button" className="btn-primary btn-xs" disabled={busy === quote.numero} onClick={() => remind(quote)}>
                          {busy === quote.numero ? 'Préparation…' : 'Préparer la relance'}
                        </button>
                      )}
                      <button type="button" className="btn-secondary btn-xs" onClick={() => onOpen(quote)} aria-label={`Ouvrir le devis ${quote.numero}`}>Ouvrir</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
