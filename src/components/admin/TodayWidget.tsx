'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDailyBriefing } from '@/actions/briefing'
import type { Briefing, BriefingLevel } from '@/lib/briefing'

const DOT: Record<BriefingLevel, string> = { urgent: '#D90000', todo: '#D97706', info: 'var(--text-subtle)' }
const LABEL: Record<BriefingLevel, string> = { urgent: 'Urgent', todo: 'À traiter', info: 'À savoir' }
const MAX_ITEMS = 5

// "Aujourd'hui", at the top of the dashboard: the same figures as NemCopilotIA's briefing,
// computed by the code from the back-office's own data (no model, no quota, nothing sent).
export default function TodayWidget() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    getDailyBriefing().then((b) => { if (alive) setBriefing(b) }, () => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  return (
    <section className="card no-lift p-4" aria-label="Aujourd'hui" data-testid="today-widget">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text)' }}>Aujourd&apos;hui</h2>
        <p className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          {briefing ? briefing.summary : failed ? 'Indisponible' : 'Chargement…'} · calculé par le code, sans IA
        </p>
      </div>

      {!briefing && !failed && <div className="animate-pulse" style={{ height: 56, background: 'var(--surface-hover)' }} />}
      {failed && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Le briefing est momentanément indisponible. Le reste du tableau de bord fonctionne normalement.</p>}

      {briefing && briefing.items.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Rien à traiter pour le moment. Un bon moment pour <Link href="/admin/quotes?vue=pipeline" className="underline" style={{ color: 'var(--text)' }}>passer en revue le pipeline des devis</Link> ou <Link href="/admin/assistant" className="underline" style={{ color: 'var(--text)' }}>préparer un article avec NemCopilotIA</Link>.
        </p>
      )}

      {briefing && briefing.items.length > 0 && (
        <ul className="space-y-1">
          {briefing.items.slice(0, MAX_ITEMS).map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex items-start gap-2.5 px-2 py-1.5 transition-colors hover:bg-[var(--surface-hover)]">
                <span className="mt-1.5 w-2 h-2 flex-shrink-0" style={{ background: DOT[item.level] }} aria-label={LABEL[item.level]} />
                <span className="min-w-0 text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                  {item.title}
                  {item.detail && <span className="block text-xs truncate" style={{ color: 'var(--text-subtle)' }}>{item.detail}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {briefing && briefing.items.length > MAX_ITEMS && (
        <p className="text-xs mt-1 px-2" style={{ color: 'var(--text-subtle)' }}>+ {briefing.items.length - MAX_ITEMS} autre{briefing.items.length - MAX_ITEMS > 1 ? 's' : ''} dans le briefing de NemCopilotIA.</p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <Link href="/admin/assistant" className="btn-primary btn-xs">Demander à NemCopilotIA</Link>
        <Link href="/admin/quotes?vue=pipeline" className="btn-secondary btn-xs">Pipeline des devis</Link>
      </div>
    </section>
  )
}
