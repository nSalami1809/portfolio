'use client'

import { useState } from 'react'
import ChatMarkdown from '@/components/chat/ChatMarkdown'
import { useToast } from '@/components/admin/Toast'
import { discardAssistantDraft, regenerateDraftEnglish } from '@/actions/assistant'
import type { BlogPayload, DraftDTO, PatchPayload } from '@/lib/assistant/drafts'

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Box({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'warn' }) {
  return (
    <div className="rounded-xl p-3 text-sm" style={{ border: `1px solid ${tone === 'warn' ? '#D97706' : 'var(--border)'}`, background: 'var(--bg-secondary)', fontFamily: 'var(--font-poppins)' }}>
      <p className="text-[10px] font-bold tracking-wider uppercase mb-1" style={{ color: tone === 'warn' ? '#D97706' : 'var(--text-subtle)' }}>{title}</p>
      {children}
    </div>
  )
}

function BlogView({ draft, payload, onChanged }: { draft: DraftDTO; payload: BlogPayload; onChanged: (d: DraftDTO) => void }) {
  const toast = useToast()
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [showPrevious, setShowPrevious] = useState(false)
  const [busy, setBusy] = useState(false)
  const previous = draft.previousPayload as BlogPayload | null
  const shown = showPrevious && previous ? previous : payload
  const fields = lang === 'fr' ? shown.fr : shown.en

  const copy = async () => {
    if (!fields) return
    try {
      await navigator.clipboard.writeText(fields.content)
      toast('Markdown copié ✓')
    } catch {
      toast('Copie impossible : sélectionne le texte à la main.', 'error')
    }
  }
  const markdown = fields ? `# ${fields.title}\n\n> ${fields.excerpt}\n\n${fields.content}\n` : ''

  const regenerate = async () => {
    setBusy(true)
    try {
      const r = await regenerateDraftEnglish(draft.id)
      if (r.ok) { onChanged(r.draft); toast('Version anglaise régénérée ✓') } else toast(r.error, 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <Box title="À reprendre dans l'éditeur du blog">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <dt>Slug</dt><dd style={{ color: 'var(--text)' }}>{payload.slug}</dd>
          <dt>Catégorie</dt><dd style={{ color: 'var(--text)' }}>{payload.category}</dd>
          <dt>Lecture</dt><dd style={{ color: 'var(--text)' }}>{payload.readTime}</dd>
          <dt>Date</dt><dd style={{ color: 'var(--text)' }}>{payload.date}</dd>
        </dl>
      </Box>

      {draft.unverifiedClaims.length > 0 && (
        <Box title="À vérifier avant de publier" tone="warn">
          <ul className="list-disc pl-4 space-y-0.5" style={{ color: 'var(--text)' }}>
            {draft.unverifiedClaims.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </Box>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['fr', 'en'] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={lang === l ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'}>
            {l === 'fr' ? 'Français' : 'English'}
          </button>
        ))}
        {previous && (
          <button type="button" className="btn-secondary btn-xs" onClick={() => setShowPrevious((v) => !v)} aria-pressed={showPrevious}>
            {showPrevious ? 'Voir la version actuelle' : 'Voir la version précédente'}
          </button>
        )}
      </div>

      {lang === 'en' && !shown.en ? (
        <Box title="Version anglaise" tone="warn">
          <p style={{ color: 'var(--text)' }}>{payload.enError ?? 'Pas de version anglaise.'}</p>
          <button type="button" className="btn-secondary btn-xs mt-2" disabled={busy} onClick={regenerate}>{busy ? 'Génération…' : 'Générer la version anglaise'}</button>
        </Box>
      ) : fields ? (
        <article className="rounded-xl p-4 text-sm" style={{ border: '1px solid var(--border)', background: 'var(--surface)', fontFamily: 'var(--font-poppins)' }}>
          <h3 className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>{fields.title}</h3>
          <p className="mb-3 italic" style={{ color: 'var(--text-muted)' }}>{fields.excerpt}</p>
          <ChatMarkdown text={fields.content} safeImages />
        </article>
      ) : null}

      {lang === 'en' && shown.en && payload.enError && (
        <Box title="Version anglaise" tone="warn"><p style={{ color: 'var(--text)' }}>{payload.enError}</p></Box>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm" disabled={!fields} onClick={copy}>Copier le Markdown</button>
        <button type="button" className="btn-secondary btn-sm" disabled={!fields} onClick={() => downloadText(`${payload.slug}.${lang}.md`, markdown)}>Télécharger .md</button>
        <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={regenerate}>{busy ? 'Génération…' : "Régénérer l'anglais"}</button>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        Pour publier : ouvre Blog dans le menu, crée l&apos;article et colle le texte. Rien n&apos;a été ajouté à ton site.
      </p>
    </div>
  )
}

function PatchView({ payload }: { payload: PatchPayload }) {
  const toast = useToast()
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Copié ✓') } catch { toast('Copie impossible.', 'error') }
  }
  return (
    <div className="space-y-3">
      <Box title="Cible"><p style={{ color: 'var(--text)' }}>{payload.target.section} · {payload.target.id} · {payload.target.field}</p></Box>
      <div className="grid gap-3 md:grid-cols-2">
        <Box title="Avant"><p style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{payload.before}</p></Box>
        <Box title="Proposition"><p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{payload.after}</p></Box>
      </div>
      {payload.rationale && <Box title="Pourquoi"><p style={{ color: 'var(--text)' }}>{payload.rationale}</p></Box>}
      {payload.afterEn && <Box title="English"><p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{payload.afterEn}</p></Box>}
      {payload.enError && <Box title="Version anglaise" tone="warn"><p style={{ color: 'var(--text)' }}>{payload.enError}</p></Box>}
      <button type="button" className="btn-primary btn-sm" onClick={() => copy(payload.after)}>Copier la proposition</button>
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Pour l&apos;appliquer : ouvre la page correspondante du menu et remplace le texte. Rien n&apos;a été modifié sur ton site.</p>
    </div>
  )
}

interface Props {
  drafts: DraftDTO[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChanged: (draft: DraftDTO) => void
  onDiscarded: (id: string) => void
}

export default function DraftsPanel({ drafts, selectedId, onSelect, onChanged, onDiscarded }: Props) {
  const toast = useToast()
  const selected = drafts.find((d) => d.id === selectedId) ?? null

  const discard = async (d: DraftDTO) => {
    if (!confirm(`Écarter le brouillon « ${d.title} » ?`)) return
    const r = await discardAssistantDraft(d.id)
    if (r.ok) { onDiscarded(d.id); toast('Brouillon écarté.') } else toast('Impossible d’écarter ce brouillon.', 'error')
  }

  return (
    <section className="card no-lift flex flex-col" style={{ minHeight: 520, maxHeight: '75dvh' }} aria-label="Brouillons de l'assistant">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
          {selected ? 'Brouillon' : `Brouillons (${drafts.length})`}
        </h2>
        {selected && <button type="button" className="btn-secondary btn-xs" onClick={() => onSelect(null)}>← Liste</button>}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selected ? (
          <div className="space-y-3">
            <div>
              <h3 className="font-display font-bold text-base" style={{ color: 'var(--text)' }}>{selected.title}</h3>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {selected.kind === 'blog_post' ? 'Article' : 'Réécriture'} · version {selected.version} · {when(selected.updatedAt)}
              </p>
            </div>
            {selected.kind === 'blog_post'
              ? <BlogView draft={selected} payload={selected.payload as BlogPayload} onChanged={onChanged} />
              : <PatchView payload={selected.payload as PatchPayload} />}
            <button type="button" className="btn-danger btn-sm" onClick={() => discard(selected)}>Écarter ce brouillon</button>
          </div>
        ) : drafts.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Aucun brouillon pour le moment. Demande à l&apos;assistant de préparer un article ou de réécrire un texte : il apparaîtra ici.
          </p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onSelect(d.id)} className="w-full text-left rounded-xl p-3 transition-colors hover:bg-[var(--surface-hover)]" style={{ border: '1px solid var(--border)' }}>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{d.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                    {d.kind === 'blog_post' ? 'Article' : 'Réécriture'} · v{d.version} · {when(d.updatedAt)}
                    {d.unverifiedClaims.length > 0 ? ` · ${d.unverifiedClaims.length} à vérifier` : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
