'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import { m, AnimatePresence } from 'framer-motion'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import DocumentUpload from '@/components/admin/DocumentUpload'
import { renderPdfThumbnail } from '@/lib/pdf-thumbnail'
import { uploadFile } from '@/lib/upload'
import type { PortfolioDocument } from '@/types'

const CATEGORIES = ['CV', 'Étude de cas', 'Guide', 'Rapport', 'Travail académique', 'Autre']
const FIXED_CATEGORIES = CATEGORIES.slice(0, -1)

function F({ label, req }: { label: string; req?: boolean }) {
  return <label className="field-label">{label}{req && <span style={{ color: '#D90000' }}> *</span>}</label>
}

const EMPTY: Omit<PortfolioDocument, 'slug'> = {
  title: '', description: '', category: 'CV',
  fileUrl: '', fileName: '', fileType: 'pdf', fileSize: 0,
  date: new Date().toISOString().slice(0, 10),
}

// CSS grid template shared by header and rows (desktop)
// cols: checkbox | reorder | icon | content | type/taille | actions
const GRID = '1rem 1.5rem 2.5rem 1fr 7rem 6.5rem'

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
    </svg>
  )
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`
}

export default function AdminDocuments() {
  const { data, updateDocuments } = usePortfolio()
  const toast = useToast()
  const [documents, setDocuments] = useState<PortfolioDocument[]>(data.documents)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<PortfolioDocument, 'slug'>>({ ...EMPTY })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  // Adopt the shared context's documents until this page makes its own edit
  const localOwned = useRef(false)
  useEffect(() => {
    if (!localOwned.current) setDocuments(data.documents)
  }, [data.documents])

  // Always the latest `documents`, readable from inside the backfill's async
  // callback below without closing over a stale snapshot (see its comment).
  const documentsRef = useRef(documents)
  useEffect(() => { documentsRef.current = documents }, [documents])

  const persist = (updated: PortfolioDocument[]) => {
    localOwned.current = true
    setDocuments(updated)
    updateDocuments(updated)
  }

  // Backfill: PDFs added before thumbnail generation existed have no
  // thumbnailUrl. Rather than making the admin re-upload each one, generate
  // it in the background the first time this page sees them — same renderer
  // DocumentUpload uses for a fresh upload, just fed the already-stored file
  // instead of a freshly picked one. Self-limiting: once persisted, the doc
  // no longer matches the "missing thumbnail" filter on a later visit.
  const backfillStarted = useRef(false)
  useEffect(() => {
    const pending = documents.filter((d) => d.fileType === 'pdf' && d.fileUrl && !d.thumbnailUrl)
    if (backfillStarted.current || !pending.length) return
    backfillStarted.current = true
    void (async () => {
      for (const doc of pending) {
        try {
          const res = await fetch(doc.fileUrl)
          if (!res.ok) continue
          const blob = await res.blob()
          const thumb = await renderPdfThumbnail(blob)
          if (!thumb) continue
          const thumbnailUrl = await uploadFile(thumb, 'thumbnail.png')
          // Read the latest state right before writing, not a snapshot taken
          // when this backfill started a few seconds (one fetch + one PDF
          // render + one upload) ago — an edit the admin made to this same
          // document in the meantime must never be clobbered by reverting
          // to that stale snapshot, only the thumbnail field is patched in.
          const latest = documentsRef.current
          if (!latest.some((d) => d.slug === doc.slug)) continue // deleted meanwhile
          persist(latest.map((d) => (d.slug === doc.slug ? { ...d, thumbnailUrl } : d)))
        } catch {
          // Best-effort — this one keeps the generic icon fallback.
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents])

  const startNew = () => { setEditingId('__new__'); setForm({ ...EMPTY }) }
  const startEdit = (d: PortfolioDocument) => { setEditingId(d.slug); const { slug: _, ...rest } = d; setForm(rest) }
  const cancelEdit = () => setEditingId(null)

  const confirmEdit = () => {
    if (!form.title.trim() || !form.fileUrl) return
    const category = form.category.trim() || 'Autre'
    const base = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const makeSlug = (b: string) => {
      let s = b
      let n = 2
      while (documents.some((d) => d.slug === s && d.slug !== editingId)) s = `${b}-${n++}`
      return s
    }
    if (editingId === '__new__') {
      persist([{ slug: makeSlug(base), ...form, category }, ...documents])
      toast('Document ajouté')
    } else {
      persist(documents.map((x) => x.slug === editingId ? { ...x, ...form, category } : x))
      toast('Document mis à jour')
    }
    setEditingId(null)
  }

  const remove = (slug: string, title: string) => {
    if (!confirm(`Supprimer « ${title} » ?`)) return
    persist(documents.filter((x) => x.slug !== slug))
    setSelected((s) => { const n = new Set(s); n.delete(slug); return n })
    toast('Document supprimé', 'error')
  }

  const bulkDelete = () => {
    if (!selected.size || !confirm(`Supprimer ${selected.size} document(s) ?`)) return
    const count = selected.size
    persist(documents.filter((x) => !selected.has(x.slug)))
    setSelected(new Set())
    toast(`${count} document(s) supprimé(s)`, 'error')
  }

  const toggleSelect = (slug: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(slug)) { n.delete(slug) } else { n.add(slug) }; return n })

  const move = (slug: string, dir: -1 | 1) => {
    const idx = documents.findIndex((d) => d.slug === slug)
    const next = idx + dir
    if (next < 0 || next >= documents.length) return
    const arr = [...documents];
    [arr[idx], arr[next]] = [arr[next], arr[idx]]
    persist(arr)
  }

  const filtered = useMemo(() => documents.filter((d) => {
    const q = search.toLowerCase()
    const ok = !q || d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
    return ok && (!filterCat || d.category === filterCat)
  }), [documents, search, filterCat])

  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0
  const categorySelectValue = FIXED_CATEGORIES.includes(form.category) ? form.category : 'Autre'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Documents</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {documents.length} document{documents.length > 1 ? 's' : ''} · Sauvegarde automatique
          </p>
        </div>
        <div className="flex items-center gap-2">
          {someSelected && (
            <button onClick={bulkDelete} className="btn-danger btn-sm">
              <TrashIcon /> Supprimer ({selected.size})
            </button>
          )}
          <button onClick={startNew} className="btn-primary btn-sm">
            + Nouveau document
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: '200px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input text-sm"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Rechercher un document…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un document"
          />
        </div>
        <select
          className="input text-sm"
          style={{ width: 'auto', minWidth: '160px' }}
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          aria-label="Filtrer par catégorie"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Form panel */}
      <AnimatePresence>
        {editingId && (
          <m.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="card no-lift p-6"
          >
            <h2 className="font-display font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>
              {editingId === '__new__' ? 'Nouveau document' : 'Modifier le document'}
            </h2>

            <div className="mb-5">
              <F label="Fichier" req />
              <DocumentUpload
                value={{ fileUrl: form.fileUrl, fileName: form.fileName, fileType: form.fileType, fileSize: form.fileSize, thumbnailUrl: form.thumbnailUrl }}
                onChange={(v) => setForm((p) => ({ ...p, ...v }))}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4 mb-5">
              <div>
                <F label="Titre" req /><input className="input text-sm" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Nom du document" />
              </div>
              <div>
                <F label="Catégorie" />
                <select
                  className="input text-sm"
                  value={categorySelectValue}
                  onChange={(e) => { const v = e.target.value; setForm((p) => ({ ...p, category: v === 'Autre' ? '' : v })) }}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {categorySelectValue === 'Autre' && (
                  <input
                    className="input text-sm mt-2"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    placeholder="Précisez la catégorie"
                    aria-label="Précisez la catégorie"
                    autoFocus
                  />
                )}
              </div>
              <div className="sm:col-span-2">
                <F label="Résumé" /><textarea className="input text-sm" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} style={{ resize: 'vertical', minHeight: '80px' }} placeholder="Résumé affiché sur la fiche du document" />
              </div>
              <div>
                <F label="Date" /><input type="date" className="input text-sm" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={confirmEdit} disabled={!form.title.trim() || !form.fileUrl} className="btn-primary btn-sm">
                {editingId === '__new__' ? 'Ajouter le document' : 'Enregistrer les modifications'}
              </button>
              <button onClick={cancelEdit} className="btn-secondary btn-sm">Annuler</button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {filtered.length === 0 && !editingId && (
        <div className="card no-lift p-12 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-glow)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--accent)' }} aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
            </svg>
          </div>
          <p className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>
            {search || filterCat ? 'Aucun résultat' : 'Aucun document'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {search || filterCat ? 'Essayez d\'autres filtres.' : 'Ajoutez votre premier document.'}
          </p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="card no-lift overflow-hidden">
          <div className="overflow-x-auto">
            {/* Header */}
            <div
              className="hidden sm:grid items-center gap-4 px-5 py-3 text-xs font-medium"
              style={{
                gridTemplateColumns: GRID,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-poppins)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                minWidth: '600px',
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((d) => d.slug)))}
                aria-label="Sélectionner tous les documents"
                className="w-4 h-4 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div aria-hidden="true" /> {/* reorder spacer */}
              <div aria-hidden="true" /> {/* icon spacer */}
              <span>Document</span>
              <span className="text-center">Fichier</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            <div style={{ minWidth: '600px' }}>
              {filtered.map((d, i) => (
                <div
                  key={d.slug}
                  className="admin-row grid items-center gap-4 px-5 py-3.5 sm:grid"
                  style={{
                    gridTemplateColumns: GRID,
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(d.slug)}
                    onChange={() => toggleSelect(d.slug)}
                    aria-label={`Sélectionner ${d.title}`}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                  />

                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => move(d.slug, -1)}
                      disabled={i === 0}
                      aria-label={`Monter ${d.title}`}
                      className="w-6 h-5 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-25"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button
                      onClick={() => move(d.slug, 1)}
                      disabled={i === filtered.length - 1}
                      aria-label={`Descendre ${d.title}`}
                      className="w-6 h-5 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-25"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>

                  {/* Icon / thumbnail */}
                  {d.thumbnailUrl ? (
                    <Image src={d.thumbnailUrl} alt="" aria-hidden="true" width={40} height={40} unoptimized className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-glow)' }} aria-hidden="true">
                      <span style={{ color: 'var(--accent)' }}><DocumentIcon /></span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{d.title}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>{d.category}</p>
                  </div>

                  {/* File type/size */}
                  <div className="flex justify-center">
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
                    >
                      {d.fileType.toUpperCase()} · {formatSize(d.fileSize)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => startEdit(d)}
                      aria-label={`Modifier ${d.title}`}
                      className="btn-secondary btn-xs btn-icon"
                      title="Modifier"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => remove(d.slug, d.title)}
                      aria-label={`Supprimer ${d.title}`}
                      className="btn-danger btn-xs btn-icon"
                      title="Supprimer"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table footer */}
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              {someSelected ? `${selected.size} sélectionné(s)` : `${filtered.length} document(s)`}
            </p>
            {filtered.length < documents.length && (
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                Filtré — {documents.length} au total
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
