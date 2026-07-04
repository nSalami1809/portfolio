'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import ImageUpload from '@/components/admin/ImageUpload'
import type { Experience, Education } from '@/types'

// Grid: checkbox | logo | content | actions
const GRID = '1rem 2.25rem 1fr 6rem'

function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}

const F = ({ label, req }: { label: string; req?: boolean }) => (
  <label className="field-label">{label}{req && <span style={{ color: '#EF4444' }}> *</span>}</label>
)

export default function AdminExperience() {
  const { data, updateExperiences, updateEducations } = usePortfolio()
  const toast = useToast()
  const [experiences, setExperiences] = useState<Experience[]>(data.experiences)
  const [educations, setEducations] = useState<Education[]>(data.educations)
  const [tab, setTab] = useState<'exp' | 'edu'>('exp')
  const [search, setSearch] = useState('')

  const [expForm, setExpForm] = useState<Omit<Experience, 'id'>>({ period: '', role: '', company: '', companyLogo: '', description: '', tags: [] })
  const [eduForm, setEduForm] = useState<Omit<Education, 'id'>>({ year: '', degree: '', school: '', schoolLogo: '', detail: '' })
  const [editExpId, setEditExpId] = useState<string | null>(null)
  const [editEduId, setEditEduId] = useState<string | null>(null)
  const [selectedExp, setSelectedExp] = useState<Set<string>>(new Set())
  const [selectedEdu, setSelectedEdu] = useState<Set<string>>(new Set())

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSearch('') }, [tab])

  const expOwned = useRef(false)
  const eduOwned = useRef(false)
  useEffect(() => {
    if (!expOwned.current) setExperiences(data.experiences)
  }, [data.experiences]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!eduOwned.current) setEducations(data.educations)
  }, [data.educations]) // eslint-disable-line react-hooks/exhaustive-deps

  const uid = () => Date.now().toString()
  const persistExp = (u: Experience[]) => { expOwned.current = true; setExperiences(u); updateExperiences(u) }
  const persistEdu = (u: Education[]) => { eduOwned.current = true; setEducations(u); updateEducations(u) }

  const filteredExp = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? experiences : experiences.filter((e) => e.role.toLowerCase().includes(q) || e.company.toLowerCase().includes(q))
  }, [experiences, search])

  const filteredEdu = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? educations : educations.filter((e) => e.degree.toLowerCase().includes(q) || e.school.toLowerCase().includes(q))
  }, [educations, search])

  const toggleExp = (id: string) => setSelectedExp((s) => { const n = new Set(s); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })
  const toggleEdu = (id: string) => setSelectedEdu((s) => { const n = new Set(s); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })

  const bulkDeleteExp = () => {
    if (!selectedExp.size || !confirm(`Supprimer ${selectedExp.size} expérience(s) ?`)) return
    const c = selectedExp.size; persistExp(experiences.filter((e) => !selectedExp.has(e.id))); setSelectedExp(new Set()); toast(`${c} supprimé(s)`, 'error')
  }
  const bulkDeleteEdu = () => {
    if (!selectedEdu.size || !confirm(`Supprimer ${selectedEdu.size} formation(s) ?`)) return
    const c = selectedEdu.size; persistEdu(educations.filter((e) => !selectedEdu.has(e.id))); setSelectedEdu(new Set()); toast(`${c} supprimé(s)`, 'error')
  }

  const confirmExp = () => {
    if (!expForm.role.trim()) return
    let updated: Experience[]
    if (editExpId === '__new__') { updated = [{ id: uid(), ...expForm }, ...experiences]; toast('Expérience ajoutée') }
    else { updated = experiences.map((x) => x.id === editExpId ? { ...x, ...expForm } : x); toast('Expérience mise à jour') }
    persistExp(updated); setEditExpId(null)
  }

  const confirmEdu = () => {
    if (!eduForm.degree.trim()) return
    let updated: Education[]
    if (editEduId === '__new__') { updated = [{ id: uid(), ...eduForm }, ...educations]; toast('Formation ajoutée') }
    else { updated = educations.map((x) => x.id === editEduId ? { ...x, ...eduForm } : x); toast('Formation mise à jour') }
    persistEdu(updated); setEditEduId(null)
  }

  const removeExp = (id: string, label: string) => {
    if (!confirm(`Supprimer « ${label} » ?`)) return
    persistExp(experiences.filter((x) => x.id !== id))
    setSelectedExp((s) => { const n = new Set(s); n.delete(id); return n })
    toast('Supprimé', 'error')
  }
  const removeEdu = (id: string, label: string) => {
    if (!confirm(`Supprimer « ${label} » ?`)) return
    persistEdu(educations.filter((x) => x.id !== id))
    setSelectedEdu((s) => { const n = new Set(s); n.delete(id); return n })
    toast('Supprimé', 'error')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Expériences & Formations</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>Sauvegarde automatique</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', width: 'fit-content', border: '1px solid var(--border)' }}>
        {(['exp', 'edu'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{
              fontFamily: 'var(--font-poppins)',
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t === 'exp' ? `Expériences (${experiences.length})` : `Formations (${educations.length})`}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: '200px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input text-sm"
            style={{ paddingLeft: '2.25rem' }}
            placeholder={tab === 'exp' ? 'Rechercher une expérience…' : 'Rechercher une formation…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={tab === 'exp' ? 'Rechercher une expérience' : 'Rechercher une formation'}
          />
        </div>
        {tab === 'exp' ? (
          <>
            <button onClick={() => { setEditExpId('__new__'); setExpForm({ period: '', role: '', company: '', companyLogo: '', description: '', tags: [] }) }} className="btn-secondary btn-sm">
              + Ajouter
            </button>
            {selectedExp.size > 0 && (
              <button onClick={bulkDeleteExp} className="btn-danger btn-sm">
                <TrashIcon /> Supprimer ({selectedExp.size})
              </button>
            )}
          </>
        ) : (
          <>
            <button onClick={() => { setEditEduId('__new__'); setEduForm({ year: '', degree: '', school: '', schoolLogo: '', detail: '' }) }} className="btn-secondary btn-sm">
              + Ajouter
            </button>
            {selectedEdu.size > 0 && (
              <button onClick={bulkDeleteEdu} className="btn-danger btn-sm">
                <TrashIcon /> Supprimer ({selectedEdu.size})
              </button>
            )}
          </>
        )}
      </div>

      {/* ─── EXPÉRIENCES ─── */}
      {tab === 'exp' && (
        <>
          <AnimatePresence>
            {editExpId && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="card no-lift p-6">
                <h2 className="font-display font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>
                  {editExpId === '__new__' ? 'Nouvelle expérience' : 'Modifier l\'expérience'}
                </h2>
                <div className="mb-4">
                  <ImageUpload label="Logo entreprise" value={expForm.companyLogo ?? ''} onChange={(v) => setExpForm((p) => ({ ...p, companyLogo: v }))} size="sm" shape="circle" />
                </div>
                <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4 mb-5">
                  <div><F label="Poste" req /><input className="input text-sm" value={expForm.role} onChange={(e) => setExpForm((p) => ({ ...p, role: e.target.value }))} placeholder="Développeur Fullstack" /></div>
                  <div><F label="Entreprise" /><input className="input text-sm" value={expForm.company} onChange={(e) => setExpForm((p) => ({ ...p, company: e.target.value }))} placeholder="Nom de l'entreprise" /></div>
                  <div><F label="Période" /><input className="input text-sm" value={expForm.period} onChange={(e) => setExpForm((p) => ({ ...p, period: e.target.value }))} placeholder="2023 — 2024" /></div>
                  <div><F label="Technologies" /><input className="input text-sm" value={expForm.tags.join(', ')} onChange={(e) => setExpForm((p) => ({ ...p, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="React, Node.js" /></div>
                  <div className="sm:col-span-2"><F label="Description" /><textarea className="input text-sm" value={expForm.description} onChange={(e) => setExpForm((p) => ({ ...p, description: e.target.value }))} rows={3} style={{ resize: 'vertical', minHeight: '80px' }} /></div>
                </div>
                <div className="flex gap-3 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={confirmExp} disabled={!expForm.role.trim()} className="btn-primary btn-sm mt-4">
                    {editExpId === '__new__' ? 'Ajouter' : 'Enregistrer'}
                  </button>
                  <button onClick={() => setEditExpId(null)} className="btn-secondary btn-sm mt-4">Annuler</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {filteredExp.length === 0 ? (
            <EmptyState label={search ? 'Aucun résultat.' : 'Aucune expérience.'} />
          ) : (
            <DataTable
              items={filteredExp}
              selected={selectedExp}
              onToggleAll={() => setSelectedExp(selectedExp.size === filteredExp.length ? new Set() : new Set(filteredExp.map((e) => e.id)))}
              renderRow={(exp, last) => (
                <div key={exp.id} className="admin-row grid items-center gap-4 px-5 py-3.5" style={{ gridTemplateColumns: GRID, borderBottom: last ? 'none' : '1px solid var(--border)' }}>
                  <input type="checkbox" checked={selectedExp.has(exp.id)} onChange={() => toggleExp(exp.id)} aria-label={`Sélectionner ${exp.role}`} className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
                  {exp.companyLogo
                    ? <img src={exp.companyLogo} alt="" aria-hidden="true" className="w-9 h-9 rounded-full object-cover" />
                    : <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }} aria-hidden="true">{(exp.company || exp.role).charAt(0).toUpperCase()}</div>
                  }
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{exp.role}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>{exp.company}{exp.period ? ` · ${exp.period}` : ''}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => { setEditExpId(exp.id); const { id: _, ...r } = exp; setExpForm(r) }} aria-label={`Modifier ${exp.role}`} className="btn-secondary btn-xs btn-icon" title="Modifier"><PencilIcon /></button>
                    <button onClick={() => removeExp(exp.id, exp.role)} aria-label={`Supprimer ${exp.role}`} className="btn-danger btn-xs btn-icon" title="Supprimer"><TrashIcon /></button>
                  </div>
                </div>
              )}
            />
          )}
        </>
      )}

      {/* ─── FORMATIONS ─── */}
      {tab === 'edu' && (
        <>
          <AnimatePresence>
            {editEduId && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="card no-lift p-6">
                <h2 className="font-display font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>
                  {editEduId === '__new__' ? 'Nouvelle formation' : 'Modifier la formation'}
                </h2>
                <div className="mb-4">
                  <ImageUpload label="Logo école / organisme" value={eduForm.schoolLogo ?? ''} onChange={(v) => setEduForm((p) => ({ ...p, schoolLogo: v }))} size="sm" shape="square" />
                </div>
                <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4 mb-5">
                  <div><F label="Diplôme / Formation" req /><input className="input text-sm" value={eduForm.degree} onChange={(e) => setEduForm((p) => ({ ...p, degree: e.target.value }))} /></div>
                  <div><F label="École / Organisme" /><input className="input text-sm" value={eduForm.school} onChange={(e) => setEduForm((p) => ({ ...p, school: e.target.value }))} /></div>
                  <div><F label="Période" /><input className="input text-sm" value={eduForm.year} onChange={(e) => setEduForm((p) => ({ ...p, year: e.target.value }))} placeholder="2022 — 2024" /></div>
                  <div><F label="Détails" /><input className="input text-sm" value={eduForm.detail} onChange={(e) => setEduForm((p) => ({ ...p, detail: e.target.value }))} /></div>
                </div>
                <div className="flex gap-3 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={confirmEdu} disabled={!eduForm.degree.trim()} className="btn-primary btn-sm mt-4">
                    {editEduId === '__new__' ? 'Ajouter' : 'Enregistrer'}
                  </button>
                  <button onClick={() => setEditEduId(null)} className="btn-secondary btn-sm mt-4">Annuler</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {filteredEdu.length === 0 ? (
            <EmptyState label={search ? 'Aucun résultat.' : 'Aucune formation.'} />
          ) : (
            <DataTable
              items={filteredEdu}
              selected={selectedEdu}
              onToggleAll={() => setSelectedEdu(selectedEdu.size === filteredEdu.length ? new Set() : new Set(filteredEdu.map((e) => e.id)))}
              renderRow={(edu, last) => (
                <div key={edu.id} className="admin-row grid items-center gap-4 px-5 py-3.5" style={{ gridTemplateColumns: GRID, borderBottom: last ? 'none' : '1px solid var(--border)' }}>
                  <input type="checkbox" checked={selectedEdu.has(edu.id)} onChange={() => toggleEdu(edu.id)} aria-label={`Sélectionner ${edu.degree}`} className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
                  {edu.schoolLogo
                    ? <img src={edu.schoolLogo} alt="" aria-hidden="true" className="w-9 h-9 rounded-lg object-cover" />
                    : <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }} aria-hidden="true">{(edu.school || edu.degree).charAt(0).toUpperCase()}</div>
                  }
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{edu.degree}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>{edu.school}{edu.year ? ` · ${edu.year}` : ''}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => { setEditEduId(edu.id); const { id: _, ...r } = edu; setEduForm(r) }} aria-label={`Modifier ${edu.degree}`} className="btn-secondary btn-xs btn-icon" title="Modifier"><PencilIcon /></button>
                    <button onClick={() => removeEdu(edu.id, edu.degree)} aria-label={`Supprimer ${edu.degree}`} className="btn-danger btn-xs btn-icon" title="Supprimer"><TrashIcon /></button>
                  </div>
                </div>
              )}
            />
          )}
        </>
      )}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="card no-lift p-10 text-center">
      <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>{label}</p>
    </div>
  )
}

function DataTable<T extends { id: string }>({
  items,
  selected,
  onToggleAll,
  renderRow,
}: {
  items: T[]
  selected: Set<string>
  onToggleAll: () => void
  renderRow: (item: T, isLast: boolean) => React.ReactNode
}) {
  const allSelected = items.length > 0 && selected.size === items.length
  return (
    <div className="card no-lift overflow-hidden">
      <div className="overflow-x-auto">
        {/* Header */}
        <div
          className="grid items-center gap-4 px-5 py-3 text-xs font-medium"
          style={{ gridTemplateColumns: GRID, color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', minWidth: '500px' }}
        >
          <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Sélectionner tout" className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
          <div aria-hidden="true" /> {/* logo spacer */}
          <span>Élément</span>
          <span className="text-right">Actions</span>
        </div>
        <div style={{ minWidth: '500px' }}>
          {items.map((item, i) => renderRow(item, i === items.length - 1))}
        </div>
      </div>
      <div className="px-5 py-2.5" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {selected.size > 0 ? `${selected.size} sélectionné(s)` : `${items.length} élément(s)`}
        </p>
      </div>
    </div>
  )
}
