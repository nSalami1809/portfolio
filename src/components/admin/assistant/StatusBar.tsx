'use client'

import { useEffect, useState } from 'react'
import type { AssistantStatus, ModelStatus } from '@/lib/assistant/guard'

const time = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Libreville', hour: '2-digit', minute: '2-digit' })

function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : m > 0 ? `${m} min ${String(sec).padStart(2, '0')} s` : `${sec} s`
}

const ROLE_LABEL: Record<ModelStatus['role'], string> = { chat: 'Analyses, audits, documents, conversations, traductions', writer: 'Rédaction et révision des articles' }

function ModelRow({ m }: { m: ModelStatus }) {
  const pct = m.dailyCap > 0 ? Math.min(100, Math.round((m.usedToday / m.dailyCap) * 100)) : 0
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span style={{ color: 'var(--text)' }}>{ROLE_LABEL[m.role]}</span>
        <span>
          <strong style={{ color: 'var(--text)' }}>{m.usedToday} / {m.dailyCap}</strong> requêtes aujourd&apos;hui
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden" style={{ background: 'var(--border)' }} role="progressbar" aria-valuemin={0} aria-valuemax={m.dailyCap} aria-valuenow={m.usedToday} aria-label={`Requêtes utilisées aujourd'hui, ${ROLE_LABEL[m.role]}`}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: pct >= 90 ? '#D90000' : 'var(--accent)' }} />
      </div>
      <p className="mt-0.5" style={{ color: 'var(--text-subtle)' }}>
        {m.id} · limite de Google : {m.official.rpd} par jour, {m.official.rpm} par minute
        {m.blockedUntil ? ' · en pause' : ''}
      </p>
    </li>
  )
}

// Read-only reminder, free-tier usage per model, and the pause banner shown when a
// quota is used up. No money anywhere: the free tier costs nothing by design.
export default function StatusBar({ status, onExpire }: { status: AssistantStatus | null; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const pausedMs = status?.pausedUntil ? new Date(status.pausedUntil).getTime() - now : 0
  const paused = Boolean(status?.paused) && pausedMs > 0
  const expired = Boolean(status?.pausedUntil) && pausedMs <= 0

  useEffect(() => {
    if (expired) onExpire()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the countdown reaches zero
  }, [expired])

  return (
    <div className="space-y-3 mb-5">
      <div className="card no-lift px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ borderColor: 'var(--accent)' }}>
        <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--accent)' }}>Sous ton contrôle</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          NemCopilotIA ne modifie jamais le site de lui-même : il analyse, conseille et prépare des brouillons. Seul le bouton « Appliquer », que tu valides, écrit sur le site (annulable).
        </span>
      </div>

      {status && status.models.length > 0 && (
        <div className="card no-lift px-4 py-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          <ul className="space-y-3">
            {status.models.map((m) => <ModelRow key={m.role} m={m} />)}
          </ul>
          <p className="mt-3" style={{ color: 'var(--text-subtle)' }}>
            Renouvellement à {time.format(new Date(status.nextReset))} (Libreville). Les plafonds restent sous les limites de Google (marge de sécurité) et chaque requête est comptée, y compris celles des outils. Aucune facturation n&apos;est activée.
          </p>
        </div>
      )}

      {status && !status.enabled && (
        <div className="card no-lift px-4 py-3 text-sm" role="alert" style={{ color: '#D90000' }}>NemCopilotIA est désactivé (ASSISTANT_ENABLED=0).</div>
      )}
      {status?.modelError && (
        <div className="card no-lift px-4 py-3 text-sm" role="alert" style={{ color: '#D90000' }}>{status.modelError}</div>
      )}
      {paused && (
        <div className="card no-lift px-4 py-3 text-sm" role="alert" style={{ borderColor: '#D90000' }}>
          <p style={{ color: 'var(--text)' }}>{status?.pauseMessage}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Reprise automatique dans <strong>{countdown(pausedMs)}</strong>. Rien n&apos;est facturé en attendant.</p>
        </div>
      )}
    </div>
  )
}
