'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getBusinessStats } from '@/actions/business'
import type { BusinessStats, ProjectRow, TodoKind } from '@/lib/business-stats'

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
const shortFmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} k` : String(n))
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' })

const TODO_LABEL: Record<TodoKind, { label: string; color: string; href: (numero: string) => string }> = {
  invoice_overdue: { label: 'Facture en retard', color: '#D90000', href: () => '/admin/invoices' },
  issue_deposit: { label: "Émettre la facture d'acompte", color: '#E45742', href: (n) => `/admin/quotes?q=${encodeURIComponent(n)}` },
  issue_balance: { label: 'Émettre la facture de solde', color: '#E45742', href: (n) => `/admin/quotes?q=${encodeURIComponent(n)}` },
  recette_deemed: { label: 'Recette réputée acceptée', color: '#008000', href: (n) => `/admin/quotes?q=${encodeURIComponent(n)}` },
  quote_expiring: { label: 'Devis bientôt expiré', color: '#B7791F', href: (n) => `/admin/quotes?q=${encodeURIComponent(n)}` },
}

function Stat({ label, value, sub, color = 'var(--text)' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card no-lift p-4 text-center">
      <p className="text-lg font-display font-bold truncate" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>{label}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>{sub}</p>}
    </div>
  )
}

function Projects({ rows, empty, dueLabel }: { rows: ProjectRow[]; empty: string; dueLabel: string }) {
  if (rows.length === 0) return <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>{empty}</p>
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.numero} className="flex items-center justify-between gap-3 text-sm">
          <Link href={`/admin/quotes?q=${encodeURIComponent(r.numero)}`} className="min-w-0 truncate" style={{ color: 'var(--text)' }}>
            <span className="font-semibold">{r.numero}</span> <span style={{ color: 'var(--text-muted)' }}>· {r.clientNom}</span>
          </Link>
          <span className="text-xs flex-shrink-0 font-semibold" style={{ color: r.late ? '#D90000' : 'var(--text-muted)' }}>
            {dueLabel} {formatDate(r.dueAt)}{r.late ? ' · dépassé' : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

// The business at a glance: what is signed, what is owed, what is late, and
// what needs doing next.
export default function AdminBusiness() {
  const [stats, setStats] = useState<BusinessStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    getBusinessStats()
      .then((s) => { if (!cancelled) setStats(s) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  if (failed) return <p className="text-sm" style={{ color: '#D90000' }}>Impossible de charger les statistiques.</p>
  if (!stats) return <div className="card no-lift p-4 animate-pulse" style={{ height: 240 }} />

  const { pipeline, cash, months } = stats
  const maxMonth = Math.max(1, ...months.map((m) => m.collected))
  const totalDecided = pipeline.signed.count + pipeline.declined.count + pipeline.expired.count

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>Activité</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Devis, projets et trésorerie en un coup d&apos;œil.
        </p>
      </div>

      {stats.todo.length > 0 && (
        <div className="card no-lift p-5 mb-6" style={{ borderColor: 'rgba(228,87,66,0.35)' }}>
          <p className="section-label mb-3">À faire ({stats.todo.length})</p>
          <ul className="space-y-2">
            {stats.todo.map((t, i) => {
              const meta = TODO_LABEL[t.kind]
              return (
                <li key={`${t.kind}-${t.numero}-${i}`}>
                  <Link href={meta.href(t.numero)} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate" style={{ color: 'var(--text)' }}>
                      <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span> · {t.numero} · {t.clientNom}
                    </span>
                    {t.detail && <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t.detail}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Encaissé" value={fmt(cash.collected)} color="#008000" />
        <Stat label="À encaisser" value={fmt(cash.outstanding)} color="#E45742" />
        <Stat label="En retard" value={fmt(cash.overdue)} sub={cash.overdueCount ? `${cash.overdueCount} facture${cash.overdueCount > 1 ? 's' : ''}` : undefined} color={cash.overdue > 0 ? '#D90000' : 'var(--text)'} />
        <Stat label="Facturé" value={fmt(cash.billed)} />
      </div>

      <div className="card no-lift p-5 mb-6">
        <p className="section-label mb-4">Encaissements — 12 derniers mois</p>
        <div className="flex items-end gap-1.5 sm:gap-2" style={{ height: 140 }} role="img" aria-label="Encaissements mensuels">
          {months.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${monthLabel(m.key)} : ${fmt(m.collected)}`}>
              <span className="text-[10px] mb-1 truncate" style={{ color: 'var(--text-subtle)', visibility: m.collected ? 'visible' : 'hidden' }}>{shortFmt(m.collected)}</span>
              <div style={{ width: '100%', height: `${Math.max(m.collected ? 4 : 2, (m.collected / maxMonth) * 100)}%`, background: m.collected ? 'var(--accent)' : 'var(--border)', minHeight: 2 }} />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 sm:gap-2 mt-2">
          {months.map((m) => <span key={m.key} className="flex-1 text-center text-[10px] min-w-0 truncate" style={{ color: 'var(--text-subtle)' }}>{monthLabel(m.key)}</span>)}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        <div className="card no-lift p-5">
          <p className="section-label mb-3">Pipeline des devis</p>
          <div className="space-y-2 text-sm">
            {([
              ['En attente de signature', pipeline.pending, 'var(--text)'],
              ['Signés', pipeline.signed, '#008000'],
              ['Refusés', pipeline.declined, '#D90000'],
              ['Expirés', pipeline.expired, 'var(--text-subtle)'],
            ] as const).map(([label, b, color]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-semibold" style={{ color }}>{b.count} · {fmt(b.amount)}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <p className="text-lg font-display font-bold" style={{ color: 'var(--text)' }}>{stats.conversionRate === null ? '—' : `${stats.conversionRate} %`}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Taux de signature{totalDecided ? ` (${totalDecided} devis tranchés)` : ''}</p>
            </div>
            <div>
              <p className="text-lg font-display font-bold" style={{ color: 'var(--text)' }}>{stats.avgDaysToSign === null ? '—' : `${stats.avgDaysToSign} j`}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Délai moyen avant signature</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card no-lift p-5">
            <p className="section-label mb-3">Projets en cours ({stats.inProgress.length})</p>
            <Projects rows={stats.inProgress} empty="Aucun projet en cours." dueLabel="livraison prévue" />
          </div>
          <div className="card no-lift p-5">
            <p className="section-label mb-3">En attente de recette ({stats.awaitingRecette.length})</p>
            <Projects rows={stats.awaitingRecette} empty="Aucune recette en attente." dueLabel="acceptation tacite" />
          </div>
        </div>
      </div>
    </>
  )
}
