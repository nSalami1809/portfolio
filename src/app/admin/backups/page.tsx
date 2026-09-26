'use client'

import { useCallback, useEffect, useState } from 'react'
import { listBackups, runBackupNow, deleteBackup, type AdminBackup } from '@/actions/backups'
import { useToast } from '@/components/admin/Toast'

const formatDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const formatSize = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`)
const totalDocs = (b: AdminBackup) => Object.values(b.collections).reduce((a, c) => a + c, 0)

// Weekly encrypted copy of the whole database. Files are unreadable without
// the passphrase (BACKUP_ENCRYPTION_KEY) and are restored with a local script.
export default function AdminBackups() {
  const toast = useToast()
  const [state, setState] = useState<{ configured: boolean; keep: number; backups: AdminBackup[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => listBackups().then(setState), [])

  useEffect(() => {
    let cancelled = false
    listBackups()
      .then((s) => { if (!cancelled) setState(s) })
      .catch(() => { if (!cancelled) toast('Chargement impossible.', 'error') })
    return () => { cancelled = true }
  }, [toast])

  const backupNow = async () => {
    setBusy(true)
    try {
      const result = await runBackupNow()
      toast(result.message, result.ok ? undefined : 'error')
      if (result.ok) await load()
    } catch {
      toast('Une erreur est survenue.', 'error')
    } finally { setBusy(false) }
  }

  const remove = async (b: AdminBackup) => {
    if (!confirm('Supprimer cette sauvegarde ?')) return
    const result = await deleteBackup(b.id)
    if (result.ok) { toast('Sauvegarde supprimée.'); await load() } else toast('Suppression impossible.', 'error')
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>Sauvegardes</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Copie chiffrée de toute la base, chaque dimanche à 03 h (UTC) ; les {state?.keep ?? 8} dernières sont conservées.
          </p>
        </div>
        <button className="btn-primary btn-sm" onClick={backupNow} disabled={busy || state?.configured === false}>
          {busy ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
        </button>
      </div>

      {state && !state.configured && (
        <div className="card no-lift p-4 mb-6 text-sm" style={{ borderColor: 'rgba(217,0,0,0.35)', color: 'var(--text)' }}>
          <strong style={{ color: '#D90000' }}>Chiffrement non configuré.</strong> Ajoutez la variable d&apos;environnement <code>BACKUP_ENCRYPTION_KEY</code> (une phrase secrète de 16 caractères minimum) sur Vercel :
          aucune sauvegarde n&apos;est faite tant qu&apos;elle est absente, pour ne jamais stocker de données personnelles en clair.
        </div>
      )}

      {!state ? (
        <div className="card no-lift p-4 animate-pulse" style={{ height: 72 }} />
      ) : state.backups.length === 0 ? (
        <div className="card no-lift p-10 text-center">
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucune sauvegarde</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>La première sera créée dimanche, ou tout de suite avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {state.backups.map((b) => (
            <div key={b.id} className="card no-lift p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatDate(b.createdAt)}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                  {totalDocs(b)} documents · {Object.keys(b.collections).length} collections · {formatSize(b.size)}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <a href={b.url} download style={{ color: 'var(--accent)' }}>Télécharger (chiffrée)</a>
                <button type="button" onClick={() => remove(b)} style={{ color: '#D90000' }}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card no-lift p-5 mt-6 text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <p className="section-label mb-2">Restaurer une sauvegarde</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Téléchargez le fichier <code>.nsb</code> ci-dessus.</li>
          <li>Déchiffrez-le en local :<br /><code className="text-xs">BACKUP_ENCRYPTION_KEY=&quot;votre phrase&quot; node scripts/decrypt-backup.mjs fichier.nsb dossier-sortie</code></li>
          <li>Réimportez la collection voulue :<br /><code className="text-xs">mongoimport --uri &quot;$MONGODB_URI&quot; --collection quotes --file dossier-sortie/quotes.json --jsonArray --mode=upsert</code></li>
        </ol>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
          Conservez la phrase secrète ailleurs que sur ce serveur : sans elle, aucune sauvegarde n&apos;est lisible.
        </p>
      </div>
    </>
  )
}
