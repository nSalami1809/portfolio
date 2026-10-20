'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ChatMarkdown from '@/components/chat/ChatMarkdown'
import { diffStats, diffText } from '@/lib/text-diff'
import { useToast } from '@/components/admin/Toast'
import { usePortfolio } from '@/providers/PortfolioContext'
import { discardAssistantDraft, markReminderSent, regenerateDraftEnglish, saveReminderText } from '@/actions/assistant'
import { applyAssistantDraft, undoAssistantDraft } from '@/actions/assistant-apply'
import type { BlogPayload, DraftDTO, DraftKind, PatchPayload } from '@/lib/assistant/drafts'
import { mailtoHref, type ReminderPayload } from '@/lib/assistant/reminders'

const KIND_LABEL: Record<DraftKind, string> = { blog_post: 'Article', field_patch: 'Réécriture', email_reminder: 'E-mail' }

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
    <div className="p-3 text-sm" style={{ border: `1px solid ${tone === 'warn' ? '#D97706' : 'var(--border)'}`, background: 'var(--bg-secondary)', fontFamily: 'var(--font-poppins)' }}>
      <p className="text-[10px] font-bold tracking-wider uppercase mb-1" style={{ color: tone === 'warn' ? '#D97706' : 'var(--text-subtle)' }}>{title}</p>
      {children}
    </div>
  )
}

// Word-level before/after: removed words struck through on red, added words on green.
function DiffText({ before, after }: { before: string; after: string }) {
  const segments = useMemo(() => diffText(before, after), [before, after])
  return (
    <p className="text-sm" data-testid="diff-text" style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'var(--font-poppins)' }}>
      {segments.map((s, i) => s.kind === 'same'
        ? <span key={i}>{s.text}</span>
        : s.kind === 'del'
          ? <del key={i} style={{ background: 'rgba(185,28,28,0.16)', color: 'inherit', textDecorationColor: '#B91C1C' }}>{s.text}</del>
          : <ins key={i} style={{ background: 'rgba(21,128,61,0.2)', color: 'inherit', textDecoration: 'none' }}>{s.text}</ins>)}
    </p>
  )
}

function DiffBox({ title, before, after }: { title: string; before: string; after: string }) {
  const stats = useMemo(() => diffStats(diffText(before, after)), [before, after])
  return (
    <Box title={`${title} · ${stats.changed ? `+${stats.added} mot${stats.added > 1 ? 's' : ''}, −${stats.removed}` : 'inchangé'}`}>
      <DiffText before={before} after={after} />
    </Box>
  )
}

function BlogView({ draft, payload, onChanged }: { draft: DraftDTO; payload: BlogPayload; onChanged: (d: DraftDTO) => void }) {
  const toast = useToast()
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [showPrevious, setShowPrevious] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
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
        {previous && (
          <button type="button" className={showDiff ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'} onClick={() => setShowDiff((v) => !v)} aria-pressed={showDiff}>
            Voir les changements
          </button>
        )}
      </div>

      {showDiff && previous && (() => {
        const was = lang === 'fr' ? previous.fr : previous.en
        const now = lang === 'fr' ? payload.fr : payload.en
        if (!was || !now) return <Box title="Changements" tone="warn"><p style={{ color: 'var(--text)' }}>Pas de version {lang === 'fr' ? 'française' : 'anglaise'} à comparer.</p></Box>
        return (
          <div className="space-y-2">
            <DiffBox title="Titre" before={was.title} after={now.title} />
            <DiffBox title="Extrait" before={was.excerpt} after={now.excerpt} />
            <DiffBox title="Contenu" before={was.content} after={now.content} />
          </div>
        )
      })()}

      {showDiff ? null : lang === 'en' && !shown.en ? (
        <Box title="Version anglaise" tone="warn">
          <p style={{ color: 'var(--text)' }}>{payload.enError ?? 'Pas de version anglaise.'}</p>
          <button type="button" className="btn-secondary btn-xs mt-2" disabled={busy} onClick={regenerate}>{busy ? 'Génération…' : 'Générer la version anglaise'}</button>
        </Box>
      ) : fields ? (
        <article className="p-4 text-sm" style={{ border: '1px solid var(--border)', background: 'var(--surface)', fontFamily: 'var(--font-poppins)' }}>
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
  const [sideBySide, setSideBySide] = useState(false)
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Copié ✓') } catch { toast('Copie impossible.', 'error') }
  }
  return (
    <div className="space-y-3">
      <Box title="Cible"><p style={{ color: 'var(--text)' }}>{payload.target.section} · {payload.target.id} · {payload.target.field}</p></Box>
      <div className="flex gap-2">
        <button type="button" className={sideBySide ? 'btn-secondary btn-xs' : 'btn-primary btn-xs'} aria-pressed={!sideBySide} onClick={() => setSideBySide(false)}>Changements</button>
        <button type="button" className={sideBySide ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'} aria-pressed={sideBySide} onClick={() => setSideBySide(true)}>Avant / après</button>
      </div>
      {sideBySide ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Box title="Avant"><p style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{payload.before}</p></Box>
          <Box title="Proposition"><p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{payload.after}</p></Box>
        </div>
      ) : (
        <DiffBox title="Ce qui changerait" before={payload.before} after={payload.after} />
      )}
      {payload.rationale && <Box title="Pourquoi"><p style={{ color: 'var(--text)' }}>{payload.rationale}</p></Box>}
      {payload.afterEn && <Box title="English"><p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{payload.afterEn}</p></Box>}
      {payload.enError && <Box title="Version anglaise" tone="warn"><p style={{ color: 'var(--text)' }}>{payload.enError}</p></Box>}
      <button type="button" className="btn-primary btn-sm" onClick={() => copy(payload.after)}>Copier la proposition</button>
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Pour l&apos;appliquer : ouvre la page correspondante du menu et remplace le texte. Rien n&apos;a été modifié sur ton site.</p>
    </div>
  )
}

// A reminder e-mail: written by the code from the real quote, editable here, and sent by
// the admin from their own mail app. This view has no way to send anything.
function EmailView({ draft, payload, onChanged }: { draft: DraftDTO; payload: ReminderPayload; onChanged: (d: DraftDTO) => void }) {
  const toast = useToast()
  const [marking, setMarking] = useState(false)
  const sentCount = draft.sentCount ?? 0
  const markSent = async (sent: boolean) => {
    setMarking(true)
    try {
      const r = await markReminderSent(draft.id, sent)
      if (r.ok) { onChanged(r.draft); toast(sent ? 'Relance notée comme envoyée ✓' : 'Note retirée.') } else toast(r.error, 'error')
    } catch {
      toast('Impossible de modifier la note (erreur serveur).', 'error')
    } finally { setMarking(false) }
  }
  const [subject, setSubject] = useState(payload.subject)
  const [body, setBody] = useState(payload.body)
  // Edits are saved a moment after the last keystroke, so they survive closing the panel.
  const [save, setSave] = useState<'saved' | 'saving' | 'error'>('saved')
  const last = useRef({ subject: payload.subject, body: payload.body })
  useEffect(() => {
    if (subject === last.current.subject && body === last.current.body) return
    const timer = setTimeout(() => {
      setSave('saving')
      saveReminderText(draft.id, subject, body).then(
        (r) => { if (r.ok) { last.current = { subject, body }; setSave('saved') } else setSave('error') },
        () => setSave('error'),
      )
    }, 900)
    return () => clearTimeout(timer)
  }, [subject, body, draft.id])
  const copy = async (text: string, done: string) => {
    try { await navigator.clipboard.writeText(text); toast(done) } catch { toast('Copie impossible : sélectionne le texte à la main.', 'error') }
  }
  const mailto = mailtoHref({ to: payload.to, subject, body })
  return (
    <div className="space-y-3">
      <Box title="Non envoyé">
        <p className="text-xs" style={{ color: 'var(--text)' }}>
          Relance du devis {payload.quoteNumero} · {payload.daysWaiting} jour{payload.daysWaiting > 1 ? 's' : ''} sans réponse{payload.expired ? ' · devis expiré' : ''}.
          NemCopilotIA n&apos;envoie rien : tu relis, tu copies ou tu ouvres ta messagerie, puis tu envoies toi-même.
        </p>
      </Box>
      {payload.to ? (
        <p className="text-sm" data-testid="email-to" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}><strong>À :</strong> {payload.toName ? `${payload.toName} · ` : ''}{payload.to}</p>
      ) : (
        <Box title="Pas d'adresse e-mail" tone="warn"><p style={{ color: 'var(--text)' }}>Ce devis n&apos;a pas d&apos;adresse e-mail : contacte le client par un autre moyen (téléphone, WhatsApp) avec ce texte.</p></Box>
      )}
      <label className="block text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-subtle)' }} htmlFor={`mail-subject-${draft.id}`}>Objet</label>
      <input id={`mail-subject-${draft.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="input text-sm w-full" />
      <label className="block text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-subtle)' }} htmlFor={`mail-body-${draft.id}`}>Message</label>
      <textarea id={`mail-body-${draft.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={4000} className="input text-sm w-full" style={{ resize: 'vertical', fontFamily: 'var(--font-poppins)' }} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={() => copy(body, 'Mail copié ✓')}>Copier le mail</button>
        <a className="btn-secondary btn-sm" href={mailto}>Ouvrir dans ma messagerie</a>
        <button type="button" className="btn-secondary btn-sm" onClick={() => copy(subject, 'Objet copié ✓')}>Copier l&apos;objet</button>
      </div>
      <div className="p-3 text-sm space-y-2" data-testid="email-sent-box" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontFamily: 'var(--font-poppins)' }}>
        {sentCount > 0 && draft.sentAt ? (
          <>
            <p style={{ color: 'var(--text)' }} data-testid="email-sent">Marquée envoyée le {when(draft.sentAt)}{sentCount > 1 ? ` (${sentCount} fois)` : ''}. NemCopilotIA s&apos;en sert pour ne pas relancer trop tôt.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary btn-xs" disabled={marking} onClick={() => markSent(true)}>Envoyée de nouveau</button>
              <button type="button" className="btn-secondary btn-xs" disabled={marking} onClick={() => markSent(false)}>Retirer la note</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Après l&apos;avoir envoyé depuis ta messagerie, note-le : le briefing et NemCopilotIA sauront que ce devis a été relancé.</p>
            <button type="button" className="btn-primary btn-sm" disabled={marking} onClick={() => markSent(true)}>{marking ? 'Enregistrement…' : "J'ai envoyé ce mail"}</button>
          </>
        )}
      </div>
      <p className="text-xs" role="status" data-testid="email-save-state" style={{ color: save === 'error' ? '#D90000' : 'var(--text-subtle)' }}>
        {save === 'saving' ? 'Enregistrement…' : save === 'error' ? "Modifications non enregistrées (objet et message ne doivent pas être vides). Copie le texte avant de fermer." : 'Modifications enregistrées automatiquement.'} Demande un autre ton à NemCopilotIA pour régénérer.
      </p>
    </div>
  )
}

// The only place where a draft touches the site: an explicit click, a confirmation,
// a server-side check that nothing changed meanwhile, and a one-click undo.
function ApplyBox({ draft, onChanged }: { draft: DraftDTO; onChanged: (d: DraftDTO) => void }) {
  const toast = useToast()
  const { flushNow, refreshNow } = usePortfolio()
  const [busy, setBusy] = useState(false)
  const [publish, setPublish] = useState(false)
  const [includeEnglish, setIncludeEnglish] = useState(true)
  const [acknowledgeClaims, setAcknowledgeClaims] = useState(false)
  const isBlog = draft.kind === 'blog_post'
  const blog = draft.payload as BlogPayload
  const hasEnglish = isBlog && Boolean(blog.en)
  const claims = draft.unverifiedClaims.length

  const done = async (r: Awaited<ReturnType<typeof applyAssistantDraft>>, fallback: string) => {
    if (!r.ok) { toast(r.error, 'error'); return }
    if (r.draft) onChanged(r.draft)
    toast(r.summary || fallback)
    for (const w of r.warnings) toast(w, 'error')
    await refreshNow()
  }

  const apply = async () => {
    const what = isBlog
      ? publish
        ? `PUBLIER l'article « ${draft.title} » sur ton site maintenant ?`
        : `Ajouter l'article « ${draft.title} » à ton blog, masqué (tu le publieras toi-même depuis l'éditeur du blog) ?`
      : `Remplacer le texte actuel du site par cette proposition (${draft.title}) ?`
    if (!confirm(`${what}\n\nUne annulation en un clic restera possible tant que cette partie du site n'est pas modifiée.`)) return
    setBusy(true)
    try {
      await flushNow() // send any pending editor changes first, so they are in the version checked below
      await done(await applyAssistantDraft(draft.id, { publish: isBlog && publish, includeEnglish: hasEnglish && includeEnglish, acknowledgeClaims }), 'Appliqué ✓')
    } catch {
      toast("Impossible d'appliquer le brouillon (erreur serveur).", 'error')
    } finally { setBusy(false) }
  }

  const undo = async () => {
    if (!confirm("Annuler l'application de ce brouillon et remettre le site comme avant ?")) return
    setBusy(true)
    try {
      await flushNow()
      await done(await undoAssistantDraft(draft.id), 'Annulé ✓')
    } catch {
      toast("Impossible d'annuler (erreur serveur).", 'error')
    } finally { setBusy(false) }
  }

  if (draft.status === 'applied' && draft.applied) {
    return (
      <Box title="Appliqué au site">
        <p style={{ color: 'var(--text)' }}>{draft.applied.summary}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{when(draft.applied.at)}{draft.applied.published ? ' · publié' : ''}</p>
        <button type="button" className="btn-secondary btn-sm mt-2" disabled={busy} onClick={undo}>{busy ? 'Annulation…' : "Annuler l'application"}</button>
      </Box>
    )
  }

  return (
    <Box title="Appliquer au site">
      <div className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        {isBlog && (
          <>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="mt-0.5" />
              <span>Publier tout de suite <span style={{ color: 'var(--text-subtle)' }}>(sinon : ajouté au blog masqué)</span></span>
            </label>
            {hasEnglish && (
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={includeEnglish} onChange={(e) => setIncludeEnglish(e.target.checked)} className="mt-0.5" />
                <span>Enregistrer la version anglaise relue <span style={{ color: 'var(--text-subtle)' }}>(sinon : traduction automatique du site)</span></span>
              </label>
            )}
            {publish && claims > 0 && (
              <label className="flex items-start gap-2" style={{ color: '#D97706' }}>
                <input type="checkbox" checked={acknowledgeClaims} onChange={(e) => setAcknowledgeClaims(e.target.checked)} className="mt-0.5" />
                <span>J&apos;ai vérifié les {claims} affirmation{claims > 1 ? 's' : ''} à vérifier ci-dessus</span>
              </label>
            )}
          </>
        )}
        <button type="button" className="btn-primary btn-sm" disabled={busy || (publish && claims > 0 && !acknowledgeClaims)} onClick={apply}>
          {busy ? 'Application…' : isBlog ? (publish ? "Publier l'article" : 'Ajouter au blog (masqué)') : 'Appliquer cette modification'}
        </button>
        <p style={{ color: 'var(--text-subtle)' }}>Vérifié côté serveur : rien n&apos;est écrit si le site a changé entre-temps.</p>
      </div>
    </Box>
  )
}

interface Props {
  drafts: DraftDTO[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChanged: (draft: DraftDTO) => void
  onDiscarded: (id: string) => void
  /** Rendered inside the chat window (no card of its own) with a close button. */
  embedded?: boolean
  onClose?: () => void
}

export default function DraftsPanel({ drafts, selectedId, onSelect, onChanged, onDiscarded, embedded, onClose }: Props) {
  const toast = useToast()
  const selected = drafts.find((d) => d.id === selectedId) ?? null

  const discard = async (d: DraftDTO) => {
    if (!confirm(`Écarter le brouillon « ${d.title} » ?`)) return
    const r = await discardAssistantDraft(d.id)
    if (r.ok) { onDiscarded(d.id); toast('Brouillon écarté.') } else toast('Impossible d’écarter ce brouillon.', 'error')
  }

  return (
    <section className={embedded ? 'flex flex-col h-full' : 'card no-lift flex flex-col'} style={embedded ? undefined : { minHeight: 520, maxHeight: '75dvh' }} aria-label="Brouillons de l'assistant">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>
          {selected ? 'Brouillon' : `Brouillons (${drafts.length})`}
        </h2>
        <div className="flex items-center gap-2">
          {selected && <button type="button" className="btn-secondary btn-xs" onClick={() => onSelect(null)}>← Liste</button>}
          {onClose && <button type="button" className="btn-secondary btn-xs" aria-label="Fermer les brouillons" onClick={onClose}>✕</button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selected ? (
          <div className="space-y-3">
            <div>
              <h3 className="font-display font-bold text-base" style={{ color: 'var(--text)' }}>{selected.title}</h3>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {KIND_LABEL[selected.kind]} · version {selected.version} · {when(selected.updatedAt)}
              </p>
            </div>
            {selected.kind !== 'email_reminder' && <ApplyBox key={selected.id + selected.version + selected.status} draft={selected} onChanged={onChanged} />}
            {selected.kind === 'blog_post' && <BlogView draft={selected} payload={selected.payload as BlogPayload} onChanged={onChanged} />}
            {selected.kind === 'field_patch' && <PatchView payload={selected.payload as PatchPayload} />}
            {selected.kind === 'email_reminder' && <EmailView key={selected.id + selected.version} draft={selected} payload={selected.payload as ReminderPayload} onChanged={onChanged} />}
            {selected.status === 'draft' && <button type="button" className="btn-danger btn-sm" onClick={() => discard(selected)}>Écarter ce brouillon</button>}
          </div>
        ) : drafts.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Aucun brouillon pour le moment. Demande à l&apos;assistant de préparer un article ou de réécrire un texte : il apparaîtra ici.
          </p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onSelect(d.id)} className="w-full text-left p-3 transition-colors hover:bg-[var(--surface-hover)]" style={{ border: '1px solid var(--border)' }}>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{d.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                    {d.status === 'applied' ? 'Appliqué · ' : ''}{d.sentAt ? 'Envoyé · ' : ''}{KIND_LABEL[d.kind]} · v{d.version} · {when(d.updatedAt)}
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
