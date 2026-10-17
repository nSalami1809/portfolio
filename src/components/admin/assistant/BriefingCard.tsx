'use client'

import Link from 'next/link'
import type { Briefing, BriefingLevel } from '@/lib/briefing'

const DOT: Record<BriefingLevel, string> = { urgent: '#D90000', todo: '#D97706', info: 'var(--text-subtle)' }
const LABEL: Record<BriefingLevel, string> = { urgent: 'Urgent', todo: 'À traiter', info: 'À savoir' }

// "À traiter aujourd'hui", computed by the code from the back-office's own data:
// no model, no quota, nothing sent anywhere.
export default function BriefingCard({ briefing, onRefresh }: { briefing: Briefing | null; onRefresh: () => void }) {
  return (
    <section className="card no-lift p-4 mb-5" aria-label="Briefing du jour">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>À traiter aujourd&apos;hui</h2>
          <p className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            {briefing ? briefing.summary : 'Chargement…'} · calculé à partir de tes données, sans IA
          </p>
        </div>
        <button type="button" className="btn-secondary btn-xs" onClick={onRefresh}>Actualiser</button>
      </div>
      {briefing && briefing.items.length > 0 && (
        <ul className="space-y-1.5">
          {briefing.items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-hover)]">
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: DOT[item.level] }} aria-label={LABEL[item.level]} />
                <span className="min-w-0 text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                  {item.title}
                  {item.detail && <span className="block text-xs truncate" style={{ color: 'var(--text-subtle)' }}>{item.detail}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
