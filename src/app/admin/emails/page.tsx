'use client'

import { useCallback, useEffect, useState } from 'react'
import { listMailFailures, resolveMailFailure, retryMailFailure, type AdminMailFailure } from '@/actions/mail-failures'
import { useToast } from '@/components/admin/Toast'

const KIND_LABEL: Record<AdminMailFailure['kind'], string> = {
  devis: 'Devis', contrat: 'Contrat', pv: 'Procès-verbal', facture: 'Facture', recu: 'Reçu', admin: 'Notification admin',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Emails to clients (devis, contrat, PV, factures, reçus) leave the server
// after the request has ended — when one fails, nobody would otherwise know
// the client is still waiting. Every failure lands here until handled.
export default function AdminEmails() {
  const toast = useToast()
  const [items, setItems] = useState<AdminMailFailure[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setItems(await listMailFailures()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const retry = async (id: string) => {
    setBusy(id)
    try {
      const result = await retryMailFailure(id)
      toast(result.message, result.ok ? undefined : 'error')
      if (result.ok) await load()
    } catch {
      toast('Une erreur est survenue.', 'error')
    } finally { setBusy(null) }
  }

  const markDone = async (id: string) => {
    setBusy(id)
    try { await resolveMailFailure(id); await load() } finally { setBusy(null) }
  }

  const pending = items.filter((i) => !i.resolved)
  const done = items.filter((i) => i.resolved)

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>Emails en échec</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {pending.length > 0
            ? `${pending.length} email${pending.length > 1 ? 's' : ''} n'${pending.length > 1 ? 'ont' : 'a'} pas pu être envoyé${pending.length > 1 ? 's' : ''} : le client attend peut-être.`
            : 'Tous les emails sont partis.'}
        </p>
      </div>

      {loading ? (
        <div className="card no-lift p-4 animate-pulse" style={{ height: 72 }} />
      ) : items.length === 0 ? (
        <div className="card no-lift p-10 text-center">
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucun échec</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Les devis, contrats, procès-verbaux, factures et reçus sont bien envoyés.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...pending, ...done].map((f) => (
            <div key={f.id} className="card no-lift p-4" style={f.resolved ? { opacity: 0.6 } : { borderColor: 'rgba(217,0,0,0.35)' }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {KIND_LABEL[f.kind]} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· {f.to}</span>
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-subtle)' }}>{f.subject}</p>
                  <p className="text-xs mt-1" style={{ color: f.resolved ? 'var(--text-subtle)' : '#D90000' }}>{f.error}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{formatDate(f.createdAt)}{f.resolved ? ' · traité' : ''}</p>
                </div>
                {!f.resolved && (
                  <div className="flex gap-2 flex-shrink-0">
                    {f.retryable && (
                      <button className="btn-primary btn-xs" disabled={busy === f.id} onClick={() => retry(f.id)}>
                        {busy === f.id ? 'Envoi…' : 'Renvoyer'}
                      </button>
                    )}
                    <button className="btn-secondary btn-xs" disabled={busy === f.id} onClick={() => markDone(f.id)}>Marquer comme traité</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
