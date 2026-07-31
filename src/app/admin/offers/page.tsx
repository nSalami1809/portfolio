'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import ImageUpload from '@/components/admin/ImageUpload'
import type { Offer } from '@/types'

const EMPTY: Omit<Offer, 'id'> = { title: '', description: '', priceLabel: '', features: [], featured: false, image: '' }
const GRID = '1rem 2.5rem 1fr 8rem 6rem'

function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}

const F = ({ label, req }: { label: string; req?: boolean }) => (
  <label className="field-label">{label}{req && <span style={{ color: '#EF4444' }}> *</span>}</label>
)

export default function AdminOffers() {
  const { data, updateOffers } = usePortfolio()
  const toast = useToast()
  const [offers, setOffers] = useState<Offer[]>(data.offers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Offer, 'id'>>({ ...EMPTY })
  const [featuresText, setFeaturesText] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const localOwned = useRef(false)
  useEffect(() => {
    if (!localOwned.current) setOffers(data.offers)
  }, [data.offers])

  const uid = () => Date.now().toString()
  const persist = (updated: Offer[]) => { localOwned.current = true; setOffers(updated); updateOffers(updated) }

  const startNew = () => { setEditingId('__new__'); setForm({ ...EMPTY }); setFeaturesText('') }
  const startEdit = (o: Offer) => {
    setEditingId(o.id)
    const { id: _, ...rest } = o
    setForm(rest)
    setFeaturesText((o.features ?? []).join('\n'))
  }

  const confirmEdit = () => {
    if (!form.title.trim() || !form.priceLabel.trim()) return
    const features = featuresText.split('\n').map((f) => f.trim()).filter(Boolean)
    const payload = { ...form, features }
    if (editingId === '__new__') { persist([...offers, { id: uid(), ...payload }]); toast('Offre ajoutée') }
    else { persist(offers.map((x) => x.id === editingId ? { ...x, ...payload } : x)); toast('Offre mise à jour') }
    setEditingId(null)
  }

  const remove = (id: string, title: string) => {
    if (!confirm(`Supprimer l'offre « ${title} » ?`)) return
    persist(offers.filter((x) => x.id !== id))
    setSelected((s) => { const n = new Set(s); n.delete(id); return n })
    toast('Offre supprimée', 'error')
  }

  const bulkDelete = () => {
    if (!selected.size || !confirm(`Supprimer ${selected.size} offre(s) ?`)) return
    const c = selected.size; persist(offers.filter((x) => !selected.has(x.id))); setSelected(new Set()); toast(`${c} supprimée(s)`, 'error')
  }

  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? offers : offers.filter((o) => o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q))
  }, [offers, search])

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Mes Offres</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {offers.length} offre{offers.length !== 1 ? 's' : ''} · Affichées sur la page publique et utilisées par le chatbot pour générer les devis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={bulkDelete} className="btn-danger btn-sm">
              <TrashIcon /> Supprimer ({selected.size})
            </button>
          )}
          <button onClick={startNew} className="btn-primary btn-sm">+ Nouvelle offre</button>
        </div>
      </div>

      {/* Search */}
      <div className="relative" style={{ maxWidth: '380px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input className="input text-sm" style={{ paddingLeft: '2.25rem' }} placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher une offre" />
      </div>

      {/* Form */}
      <AnimatePresence>
        {editingId && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="card no-lift p-6">
            <h2 className="font-display font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>
              {editingId === '__new__' ? 'Nouvelle offre' : "Modifier l'offre"}
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4 mb-5">
              <div className="sm:col-span-2">
                <ImageUpload
                  label="Image de l'offre"
                  value={form.image ?? ''}
                  onChange={(v) => setForm((p) => ({ ...p, image: v }))}
                  size="md"
                  shape="square"
                  placeholder="Illustrer cette offre"
                />
              </div>
              <div><F label="Titre" req /><input className="input text-sm" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Site vitrine complet" /></div>
              <div><F label="Prix" req /><input className="input text-sm" value={form.priceLabel} onChange={(e) => setForm((p) => ({ ...p, priceLabel: e.target.value }))} placeholder="600 000 – 1 000 000 FCFA" /></div>
              <div className="sm:col-span-2">
                <F label="Description" req />
                <textarea className="input text-sm" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} style={{ resize: 'vertical', minHeight: '70px' }} placeholder="Une phrase qui présente cette offre…" />
              </div>
              <div className="sm:col-span-2">
                <F label="Points inclus (un par ligne)" />
                <textarea className="input text-sm" value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} rows={4} style={{ resize: 'vertical', minHeight: '90px', fontFamily: 'monospace' }} placeholder={'Multi-pages\nFormulaire de contact avancé\nSEO de base'} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="offer-featured" checked={!!form.featured} onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))} className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
                <label htmlFor="offer-featured" className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>Mettre en avant cette offre</label>
              </div>
            </div>
            <div className="flex gap-3 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={confirmEdit} disabled={!form.title.trim() || !form.priceLabel.trim()} className="btn-primary btn-sm mt-4">
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
              <path d="M20 12V8H6a2 2 0 010-4h12v4"/><path d="M4 6v12a2 2 0 002 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4Z"/>
            </svg>
          </div>
          <p className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>Aucune offre</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {search ? 'Aucun résultat pour cette recherche.' : 'Ajoutez vos prestations et leurs tarifs.'}
          </p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="card no-lift overflow-hidden">
          <div className="overflow-x-auto">
            <div
              className="grid items-center gap-4 px-5 py-3 text-xs font-medium"
              style={{ gridTemplateColumns: GRID, color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', minWidth: '520px' }}
            >
              <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((o) => o.id)))} aria-label="Sélectionner toutes" className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
              <span aria-hidden="true" />
              <span>Offre</span>
              <span>Prix</span>
              <span className="text-right">Actions</span>
            </div>

            <div style={{ minWidth: '520px' }}>
              {filtered.map((o, i) => (
                <div key={o.id} className="admin-row grid items-center gap-4 px-5 py-3.5" style={{ gridTemplateColumns: GRID, borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} aria-label={`Sélectionner ${o.title}`} className="w-4 h-4 cursor-pointer self-center" style={{ accentColor: 'var(--accent)' }} />

                  <div className="relative overflow-hidden shrink-0" style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    {o.image ? (
                      <Image src={o.image} alt="" fill sizes="32px" style={{ objectFit: 'cover' }} />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: 'var(--text-subtle)' }} aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{o.title}</p>
                      {o.featured && <span className="tag text-xs">Mise en avant</span>}
                    </div>
                    <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{o.description}</p>
                  </div>

                  <p className="text-xs font-medium" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>{o.priceLabel}</p>

                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => startEdit(o)} aria-label={`Modifier l'offre ${o.title}`} className="btn-secondary btn-xs btn-icon" title="Modifier"><PencilIcon /></button>
                    <button onClick={() => remove(o.id, o.title)} aria-label={`Supprimer l'offre ${o.title}`} className="btn-danger btn-xs btn-icon" title="Supprimer"><TrashIcon /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 py-2.5" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              {selected.size > 0 ? `${selected.size} sélectionnée(s)` : `${filtered.length} offre(s)`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
