'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import ImageUpload from '@/components/admin/ImageUpload'
import type { Project } from '@/types'

const CATEGORIES = ['Web', 'DevOps', 'Backend', 'Frontend', 'Mobile', 'IA / ML', 'Autre']

function F({ label, req }: { label: string; req?: boolean }) {
  return <label className="field-label">{label}{req && <span style={{ color: '#EF4444' }}> *</span>}</label>
}

const STATUS_LABELS: Record<Project['status'], string> = {
  completed: 'Terminé',
  'in-progress': 'En cours',
  concept: 'Concept',
}
const STATUS_COLORS: Record<Project['status'], string> = {
  completed:    '#10B981',
  'in-progress':'#F59E0B',
  concept:      '#6366F1',
}

const EMPTY: Omit<Project, 'slug'> = {
  title: '', description: '', longDescription: '', category: 'Web',
  tags: [], year: new Date().getFullYear().toString(),
  status: 'in-progress', liveUrl: '', githubUrl: '', image: '',
}

// CSS grid template shared by header and rows (desktop)
// cols: checkbox | reorder | thumb | content | status | actions
const GRID = '1rem 1.5rem 2.5rem 1fr 5.5rem 6.5rem'

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

export default function AdminProjects() {
  const { data, updateProjects } = usePortfolio()
  const toast = useToast()
  const [projects, setProjects] = useState<Project[]>(data.projects)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Project, 'slug'>>({ ...EMPTY })
  const [tagsInput, setTagsInput] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  // Adopt the shared context's projects until this page makes its own edit
  const localOwned = useRef(false)
  useEffect(() => {
    if (!localOwned.current) setProjects(data.projects)
  }, [data.projects]) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (updated: Project[]) => {
    localOwned.current = true
    setProjects(updated)
    updateProjects(updated)
  }

  const startNew = () => { setEditingId('__new__'); setForm({ ...EMPTY }); setTagsInput('') }
  const startEdit = (p: Project) => { setEditingId(p.slug); const { slug: _, ...rest } = p; setForm(rest); setTagsInput(p.tags.join(', ')) }
  const cancelEdit = () => setEditingId(null)

  const confirmEdit = () => {
    if (!form.title.trim()) return
    const base = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const makeSlug = (b: string) => {
      let s = b
      let n = 2
      while (projects.some((p) => p.slug === s && p.slug !== editingId)) s = `${b}-${n++}`
      return s
    }
    if (editingId === '__new__') {
      persist([{ slug: makeSlug(base), ...form }, ...projects])
      toast('Projet ajouté')
    } else {
      persist(projects.map((x) => x.slug === editingId ? { ...x, ...form } : x))
      toast('Projet mis à jour')
    }
    setEditingId(null)
  }

  const remove = (slug: string, title: string) => {
    if (!confirm(`Supprimer « ${title} » ?`)) return
    persist(projects.filter((x) => x.slug !== slug))
    setSelected((s) => { const n = new Set(s); n.delete(slug); return n })
    toast('Projet supprimé', 'error')
  }

  const bulkDelete = () => {
    if (!selected.size || !confirm(`Supprimer ${selected.size} projet(s) ?`)) return
    const count = selected.size
    persist(projects.filter((x) => !selected.has(x.slug)))
    setSelected(new Set())
    toast(`${count} projet(s) supprimé(s)`, 'error')
  }

  const toggleSelect = (slug: string) =>
    setSelected((s) => { const n = new Set(s); n.has(slug) ? n.delete(slug) : n.add(slug); return n })

  const move = (slug: string, dir: -1 | 1) => {
    const idx = projects.findIndex((p) => p.slug === slug)
    const next = idx + dir
    if (next < 0 || next >= projects.length) return
    const arr = [...projects];
    [arr[idx], arr[next]] = [arr[next], arr[idx]]
    persist(arr)
  }

  const filtered = useMemo(() => projects.filter((p) => {
    const q = search.toLowerCase()
    const ok = !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))
    return ok && (!filterCat || p.category === filterCat)
  }), [projects, search, filterCat])

  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Projets</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {projects.length} projet{projects.length > 1 ? 's' : ''} · Sauvegarde automatique
          </p>
        </div>
        <div className="flex items-center gap-2">
          {someSelected && (
            <button onClick={bulkDelete} className="btn-danger btn-sm">
              <TrashIcon /> Supprimer ({selected.size})
            </button>
          )}
          <button onClick={startNew} className="btn-primary btn-sm">
            + Nouveau projet
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
            placeholder="Rechercher un projet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un projet"
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
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="card no-lift p-6"
          >
            <h2 className="font-display font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>
              {editingId === '__new__' ? 'Nouveau projet' : 'Modifier le projet'}
            </h2>

            <div className="mb-5">
              <ImageUpload label="Image du projet" value={form.image ?? ''} onChange={(v) => setForm((p) => ({ ...p, image: v }))} size="lg" shape="square" placeholder="Image de couverture" />
            </div>

            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4 mb-5">
              <div>
                <F label="Titre" req /><input className="input text-sm" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Nom du projet" />
              </div>
              <div>
                <F label="Catégorie" />
                <select className="input text-sm" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <F label="Statut" />
                <select className="input text-sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Project['status'] }))}>
                  <option value="completed">Terminé</option>
                  <option value="in-progress">En cours</option>
                  <option value="concept">Concept</option>
                </select>
              </div>
              <div>
                <F label="Année" /><input className="input text-sm" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} placeholder="2025" />
              </div>
              <div className="sm:col-span-2">
                <F label="Description courte" /><input className="input text-sm" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Résumé en une phrase" />
              </div>
              <div className="sm:col-span-2">
                <F label="Description longue" />
                <textarea className="input text-sm" value={form.longDescription} onChange={(e) => setForm((p) => ({ ...p, longDescription: e.target.value }))} rows={3} style={{ resize: 'vertical', minHeight: '80px' }} />
              </div>
              <div>
                <F label="Technologies" /><input className="input text-sm" value={tagsInput} onChange={(e) => { setTagsInput(e.target.value); setForm((p) => ({ ...p, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })) }} placeholder="React, Node.js, Docker" />
              </div>
              <div>
                <F label="GitHub URL" /><input className="input text-sm" value={form.githubUrl ?? ''} onChange={(e) => setForm((p) => ({ ...p, githubUrl: e.target.value }))} placeholder="https://github.com/…" />
              </div>
              <div>
                <F label="Demo URL" /><input className="input text-sm" value={form.liveUrl ?? ''} onChange={(e) => setForm((p) => ({ ...p, liveUrl: e.target.value }))} placeholder="https://…" />
              </div>
            </div>

            <div className="flex gap-3 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={confirmEdit} disabled={!form.title.trim()} className="btn-primary btn-sm mt-4">
                {editingId === '__new__' ? 'Ajouter le projet' : 'Enregistrer les modifications'}
              </button>
              <button onClick={cancelEdit} className="btn-secondary btn-sm mt-4">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {filtered.length === 0 && !editingId && (
        <div className="card no-lift p-12 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-glow)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--accent)' }} aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <p className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>
            {search || filterCat ? 'Aucun résultat' : 'Aucun projet'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {search || filterCat ? 'Essayez d\'autres filtres.' : 'Ajoutez votre premier projet.'}
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
                minWidth: '580px',
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.slug)))}
                aria-label="Sélectionner tous les projets"
                className="w-4 h-4 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div aria-hidden="true" /> {/* reorder spacer */}
              <div aria-hidden="true" /> {/* thumb spacer */}
              <span>Projet</span>
              <span className="text-center">Statut</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            <div style={{ minWidth: '580px' }}>
              {filtered.map((p, i) => (
                <div
                  key={p.slug}
                  className="admin-row grid items-center gap-4 px-5 py-3.5 sm:grid"
                  style={{
                    gridTemplateColumns: GRID,
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.slug)}
                    onChange={() => toggleSelect(p.slug)}
                    aria-label={`Sélectionner ${p.title}`}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                  />

                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => move(p.slug, -1)}
                      disabled={i === 0}
                      aria-label={`Monter ${p.title}`}
                      className="w-6 h-5 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-25"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button
                      onClick={() => move(p.slug, 1)}
                      disabled={i === filtered.length - 1}
                      aria-label={`Descendre ${p.title}`}
                      className="w-6 h-5 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-25"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>

                  {/* Thumb */}
                  {p.image ? (
                    <img src={p.image} alt="" aria-hidden="true" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-glow)' }} aria-hidden="true">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--accent)' }} aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                  )}

                  {/* Content */}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{p.title}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>{p.category} · {p.year}</p>
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        background: `${STATUS_COLORS[p.status]}18`,
                        color: STATUS_COLORS[p.status],
                        fontFamily: 'var(--font-poppins)',
                        border: `1px solid ${STATUS_COLORS[p.status]}30`,
                      }}
                    >
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => startEdit(p)}
                      aria-label={`Modifier ${p.title}`}
                      className="btn-secondary btn-xs btn-icon"
                      title="Modifier"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => remove(p.slug, p.title)}
                      aria-label={`Supprimer ${p.title}`}
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
              {someSelected ? `${selected.size} sélectionné(s)` : `${filtered.length} projet(s)`}
            </p>
            {filtered.length < projects.length && (
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                Filtré — {projects.length} au total
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
