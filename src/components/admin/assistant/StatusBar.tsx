'use client'

import { useEffect, useState } from 'react'
import type { AssistantStatus } from '@/lib/assistant/guard'

const time = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Libreville', hour: '2-digit', minute: '2-digit' })

function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : m > 0 ? `${m} min ${String(sec).padStart(2, '0')} s` : `${sec} s`
}

// Read-only reminder, free-tier usage meter, and the pause banner shown when the
// quota is used up. No money anywhere: the free tier costs nothing by design.
export default function StatusBar({ status, onExpire }: { status: AssistantStatus | null; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const blockedMs = status?.blockedUntil ? new Date(status.blockedUntil).getTime() - now : 0
  const blocked = blockedMs > 0

  useEffect(() => {
    if (status?.blockedUntil && blockedMs <= 0) onExpire()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the countdown reaches zero
  }, [blockedMs <= 0 && Boolean(status?.blockedUntil)])

  const used = status?.today.requests ?? 0
  const cap = status?.limits.dailyRequests ?? 0
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0

  return (
    <div className="space-y-3 mb-5">
      <div className="card no-lift px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ borderColor: 'var(--accent)' }}>
        <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--accent)' }}>Sous ton contrôle</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          L&apos;assistant ne modifie jamais le site de lui-même : il analyse, conseille et prépare des brouillons. Seul le bouton « Appliquer », que tu valides, écrit sur le site (annulable).
        </span>
      </div>

      {status && (
        <div className="card no-lift px-4 py-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span>Modèle : <strong style={{ color: 'var(--text)' }}>{status.model ?? '—'}</strong> (palier gratuit)</span>
            <span>Requêtes aujourd&apos;hui : <strong style={{ color: 'var(--text)' }}>{used} / {cap}</strong></span>
            <span>Renouvellement : {time.format(new Date(status.nextReset))} (Libreville)</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }} role="progressbar" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={used} aria-label="Requêtes utilisées aujourd'hui">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 90 ? '#D90000' : 'var(--accent)' }} />
          </div>
          <p className="mt-2" style={{ color: 'var(--text-subtle)' }}>
            Plafond prudent de l&apos;application (réglable), pas le quota officiel de Google. Aucune facturation n&apos;est activée.
          </p>
        </div>
      )}

      {status && !status.enabled && (
        <div className="card no-lift px-4 py-3 text-sm" role="alert" style={{ color: '#D90000' }}>L&apos;assistant est désactivé (ASSISTANT_ENABLED=0).</div>
      )}
      {status?.modelError && (
        <div className="card no-lift px-4 py-3 text-sm" role="alert" style={{ color: '#D90000' }}>{status.modelError}</div>
      )}
      {blocked && (
        <div className="card no-lift px-4 py-3 text-sm" role="alert" style={{ borderColor: '#D90000' }}>
          <p style={{ color: 'var(--text)' }}>{status?.blockMessage}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Reprise automatique dans <strong>{countdown(blockedMs)}</strong>. Rien n&apos;est facturé en attendant.</p>
        </div>
      )}
    </div>
  )
}
