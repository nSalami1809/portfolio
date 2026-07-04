'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import ImageUpload from '@/components/admin/ImageUpload'
import type { Testimonial } from '@/types'

const EMPTY: Omit<Testimonial, 'id'> = { name: '', role: '', company: '', text: '', avatar: '' }
const GRID = '1rem 2.5rem 1fr 6rem'

function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}

const F = ({ label, req }: { label: string; req?: boolean }) => (
  <label className="field-label">{label}{req && <span style={{ color: '#EF4444' }}> *</span>}</label>
)

export default function AdminTestimonials() {
  const { data, updateTestimonials } = usePortfolio()
  const toast = useToast()
  const [testimonials, setTestimonials] = useState<Testimonial[]>(data.testimonials)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Testimonial, 'id'>>({ ...EMPTY })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const uid = () => Date.now().toString()
  const persist = (updated: Testimonial[]) => { setTestimonials(updated); updateTestimonials(updated) }

  const startNew = () => { setEditingId('__new__'); setForm({ ...EMPTY }) }
  const startEdit = (t: Testimonial) => { setEditingId(t.id); const { id: _, ...rest } = t; setForm(rest) }

  const confirmEdit = () => {
    if (!form.name.trim() || !form.text.trim()) return
    if (editingId === '__new__') { persist([...testimonials, { id: uid(), ...form }]); toast('Témoignage ajouté') }
    else { persist(testimonials.map((x) => x.id === editingId ? { ...x, ...form } : x)); toast('Témoignage mis à jour') }
    setEditingId(null)
  }

  const remove = (id: string, name: string) => {
    if (!confirm(`Supprimer le témoignage de « ${name} » ?`)) return
    persist(testimonials.filter((x) => x.id !== id))
    setSelected((s) => { const n = new Set(s); n.delete(id); return n })
    toast('Témoignage supprimé', 'error')
  }

  const bulkDelete = () => {
    if (!selected.size || !confirm(`Supprimer ${selected.size} témoignage(s) ?`)) return
    const c = selected.size; persist(testimonials.filter((x) => !selected.has(x.id))); setSelected(new Set()); toast(`${c} supprimé(s)`, 'error')
  }

  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? testimonials : testimonials.filter((t) => t.name.toLowerCase().includes(q) || t.company.toLowerCase().includes(q) || t.text.toLowerCase().includes(q))
  }, [testimonials, search])

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Témoignages</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {testimonials.length} témoignage{testimonials.length !== 1 ? 's' : ''} · Sauvegarde automatique
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={bulkDelete} className="btn-danger btn-sm">
              <TrashIcon /> Supprimer ({selected.size})
            </button>
          )}
          <button onClick={startNew} className="btn-primary btn-sm">+ Nouveau témoignage</button>
        </div>
      </div>

      {/* Search */}
      <div className="relative" style={{ maxWidth: '380px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input className="input text-sm" style={{ paddingLeft: '2.25rem' }} placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un témoignage" />
      </div>

      {/* Form */}
      <AnimatePresence>
        {editingId && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="card no-lift p-6">
            <h2 className="font-display font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>
              {editingId === '__new__' ? 'Nouveau témoignage' : 'Modifier le témoignage'}
            </h2>
            <div className="mb-4">
              <ImageUpload label="Photo / Avatar" value={form.avatar ?? ''} onChange={(v) => setForm((p) => ({ ...p, avatar: v }))} size="sm" shape="circle" />
            </div>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4 mb-5">
              <div><F label="Nom" req /><input className="input text-sm" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Prénom Nom" /></div>
              <div><F label="Poste" /><input className="input text-sm" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} placeholder="Directeur Technique" /></div>
              <div><F label="Entreprise" /><input className="input text-sm" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} placeholder="Nom de l'entreprise" /></div>
              <div className="sm:col-span-2">
                <F label="Témoignage" req />
                <textarea className="input text-sm" value={form.text} onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))} rows={4} style={{ resize: 'vertical', minHeight: '90px' }} placeholder="Ce que dit la personne à votre sujet…" />
              </div>
            </div>
            <div className="flex gap-3 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={confirmEdit} disabled={!form.name.trim() || !form.text.trim()} className="btn-primary btn-sm mt-4">
                {editingId === '__new__' ? 'Ajouter' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditingId(null)} className="btn-secondary btn-sm mt-4">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty */}
      {filtered.length === 0 && !editingId && (
        <div className="card no-lift p-12 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-glow)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--accent)' }} aria-hidden="true">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
          </div>
          <p className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>Aucun témoignage</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {search ? 'Aucun résultat pour cette recherche.' : 'Ajoutez les avis de vos clients ou collaborateurs.'}
          </p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="card no-lift overflow-hidden">
          <div className="overflow-x-auto">
            {/* Header */}
            <div
              className="grid items-center gap-4 px-5 py-3 text-xs font-medium"
              style={{ gridTemplateColumns: GRID, color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', minWidth: '480px' }}
            >
              <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((t) => t.id)))} aria-label="Sélectionner tous" className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
              <div aria-hidden="true" />
              <span>Témoignage</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            <div style={{ minWidth: '480px' }}>
              {filtered.map((t, i) => (
                <div key={t.id} className="admin-row grid items-center gap-4 px-5 py-3.5" style={{ gridTemplateColumns: GRID, borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} aria-label={`Sélectionner ${t.name}`} className="w-4 h-4 cursor-pointer self-center" style={{ accentColor: 'var(--accent)' }} />

                  {/* Avatar */}
                  {t.avatar
                    ? <img src={t.avatar} alt="" aria-hidden="true" className="w-10 h-10 rounded-full object-cover" />
                    : <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-base flex-shrink-0" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }} aria-hidden="true">{t.name.charAt(0).toUpperCase()}</div>
                  }

                  {/* Content */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{t.name}</p>
                      {t.company && <span className="text-xs" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>· {t.company}</span>}
                    </div>
                    {t.role && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{t.role}</p>}
                    <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>&ldquo;{t.text}&rdquo;</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => startEdit(t)} aria-label={`Modifier le témoignage de ${t.name}`} className="btn-secondary btn-xs btn-icon" title="Modifier"><PencilIcon /></button>
                    <button onClick={() => remove(t.id, t.name)} aria-label={`Supprimer le témoignage de ${t.name}`} className="btn-danger btn-xs btn-icon" title="Supprimer"><TrashIcon /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 py-2.5" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              {selected.size > 0 ? `${selected.size} sélectionné(s)` : `${filtered.length} témoignage(s)`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
