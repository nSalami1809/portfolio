'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import ImageUpload from '@/components/admin/ImageUpload'
import type { Skill } from '@/types'

export default function AdminSkills() {
  const { data, updateSkills } = usePortfolio()
  const toast = useToast()
  const [skills, setSkills] = useState<Skill[]>(data.skills)
  const [newCat, setNewCat] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const skillsOwned = useRef(false)
  useEffect(() => {
    if (!skillsOwned.current && data.skills.length > skills.length) setSkills(data.skills)
  }, [data.skills]) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (updated: Skill[]) => { skillsOwned.current = true; setSkills(updated); updateSkills(updated) }
  // eslint-disable-next-line react-hooks/purity
  const uid = () => Date.now().toString()

  const addCategory = () => {
    if (!newCat.trim()) return
    persist([...skills, { id: uid(), category: newCat.trim(), items: [], icons: {} }])
    setNewCat('')
    toast('Catégorie ajoutée')
  }

  const removeCategory = (id: string, name: string) => {
    if (!confirm(`Supprimer la catégorie « ${name} » et toutes ses compétences ?`)) return
    persist(skills.filter((s) => s.id !== id))
    setSelected((s) => { const n = new Set(s); n.delete(id); return n })
    toast('Catégorie supprimée', 'error')
  }

  const bulkDelete = () => {
    if (!selected.size || !confirm(`Supprimer ${selected.size} catégorie(s) ?`)) return
    const c = selected.size
    persist(skills.filter((s) => !selected.has(s.id)))
    setSelected(new Set())
    toast(`${c} catégorie(s) supprimée(s)`, 'error')
  }

  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const updateCatName = (id: string, category: string) => {
    persist(skills.map((s) => s.id === id ? { ...s, category } : s))
    toast('Catégorie renommée')
  }

  const addItem = (id: string, item: string) => {
    if (!item.trim()) return
    persist(skills.map((s) => s.id === id ? { ...s, items: [...s.items, item.trim()] } : s))
  }

  const removeItem = (id: string, item: string) => {
    persist(skills.map((s) => {
      if (s.id !== id) return s
      const icons = { ...(s.icons ?? {}) }
      delete icons[item]
      return { ...s, items: s.items.filter((i) => i !== item), icons }
    }))
  }

  const setIcon = (skillId: string, itemName: string, icon: string) => {
    persist(skills.map((s) => s.id !== skillId ? s : {
      ...s,
      icons: icon
        ? { ...(s.icons ?? {}), [itemName]: icon }
        : Object.fromEntries(Object.entries(s.icons ?? {}).filter(([k]) => k !== itemName)),
    }))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Compétences</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Organisez par catégorie · Sauvegarde automatique
          </p>
        </div>
        {selected.size > 0 && (
          <button onClick={bulkDelete} className="btn-danger btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Supprimer ({selected.size})
          </button>
        )}
      </div>

      {/* Add category */}
      <div className="card no-lift p-4 flex gap-3">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          placeholder="Nouvelle catégorie (ex: Mobile, IA / ML…)"
          className="input text-sm flex-1"
          aria-label="Nom de la nouvelle catégorie"
        />
        <button onClick={addCategory} disabled={!newCat.trim()} className="btn-primary btn-sm shrink-0">
          Ajouter
        </button>
      </div>

      {/* Empty */}
      {skills.length === 0 && (
        <div className="card no-lift p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>Aucune catégorie. Commencez par en ajouter une.</p>
        </div>
      )}

      {/* Category cards */}
      <div className="space-y-4">
        {skills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            selected={selected.has(skill.id)}
            onToggleSelect={() => toggleSelect(skill.id)}
            onUpdateCatName={(name) => updateCatName(skill.id, name)}
            onAddItem={(item) => addItem(skill.id, item)}
            onRemoveItem={(item) => removeItem(skill.id, item)}
            onRemoveCat={() => removeCategory(skill.id, skill.category)}
            onSetIcon={(name, icon) => setIcon(skill.id, name, icon)}
          />
        ))}
      </div>
    </div>
  )
}

interface SkillCardProps {
  skill: Skill
  selected: boolean
  onToggleSelect: () => void
  onUpdateCatName: (name: string) => void
  onAddItem: (item: string) => void
  onRemoveItem: (item: string) => void
  onRemoveCat: () => void
  onSetIcon: (name: string, icon: string) => void
}

function SkillCard({ skill, selected, onToggleSelect, onUpdateCatName, onAddItem, onRemoveItem, onRemoveCat, onSetIcon }: SkillCardProps) {
  const [catName, setCatName] = useState(skill.category)
  const [newItem, setNewItem] = useState('')
  const [newItemIcon, setNewItemIcon] = useState('')
  const [iconTarget, setIconTarget] = useState<string | null>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCatName(skill.category) }, [skill.category])

  const handleCatBlur = () => {
    const trimmed = catName.trim()
    if (trimmed && trimmed !== skill.category) onUpdateCatName(trimmed)
    else setCatName(skill.category)
  }

  const handleNewItemIconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 1 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => setNewItemIcon(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleAdd = () => {
    const name = newItem.trim()
    if (!name) return
    onAddItem(name)
    if (newItemIcon) onSetIcon(name, newItemIcon)
    setNewItem('')
    setNewItemIcon('')
  }

  return (
    <div
      className="card no-lift p-5"
      style={{ borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Sélectionner la catégorie ${skill.category}`}
          className="w-4 h-4 cursor-pointer flex-shrink-0"
          style={{ accentColor: 'var(--accent)' }}
        />
        <input
          className="input text-sm font-semibold flex-1"
          value={catName}
          onChange={(e) => setCatName(e.target.value)}
          onBlur={handleCatBlur}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          aria-label={`Nom de la catégorie ${skill.category}`}
          style={{ fontFamily: 'var(--font-space-grotesk)', color: 'var(--accent)' }}
        />
        <button onClick={onRemoveCat} aria-label={`Supprimer la catégorie ${skill.category}`} className="btn-danger btn-xs">
          Supprimer
        </button>
      </div>

      {/* Existing items */}
      <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
        <AnimatePresence mode="popLayout">
          {skill.items.map((item) => {
            const icon = skill.icons?.[item]
            return (
              <motion.div
                key={item}
                layout
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5 rounded-lg"
                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '0.3rem 0.65rem' }}
              >
                {icon ? (
                  <button
                    onClick={() => setIconTarget(iconTarget === item ? null : item)}
                    aria-label={`Changer l'icône de ${item}`}
                    title="Changer le logo"
                    className="flex-shrink-0 rounded transition-opacity hover:opacity-70"
                    style={{ lineHeight: 0 }}
                  >
                    <img src={icon} alt="" aria-hidden="true" className="w-4 h-4 rounded object-contain" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIconTarget(iconTarget === item ? null : item)}
                    aria-label={`Ajouter un logo à ${item}`}
                    title="Ajouter un logo"
                    className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-[var(--accent-glow)] flex-shrink-0"
                    style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
                <span className="text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>{item}</span>
                <button
                  onClick={() => onRemoveItem(item)}
                  aria-label={`Supprimer ${item}`}
                  className="w-5 h-5 flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(239,68,68,0.15)] flex-shrink-0"
                  style={{ color: 'var(--text-muted)', marginLeft: '0.125rem' }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Change icon panel (existing items) */}
      <AnimatePresence>
        {iconTarget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden mb-4"
          >
            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                  Logo pour <strong>{iconTarget}</strong>
                </p>
                <button
                  onClick={() => setIconTarget(null)}
                  aria-label="Fermer"
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <ImageUpload
                value={skill.icons?.[iconTarget] ?? ''}
                onChange={(v) => { onSetIcon(iconTarget, v); if (v) setIconTarget(null) }}
                size="sm"
                shape="square"
                placeholder="Logo"
                maxSizeMb={1}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add new item row ── */}
      <div
        className="rounded-xl p-3 flex items-center gap-2.5"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {/* Logo picker for new item */}
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={() => iconInputRef.current?.click()}
            aria-label="Ajouter un logo pour cette compétence"
            title={newItemIcon ? 'Changer le logo' : 'Ajouter un logo (optionnel)'}
            className="relative overflow-hidden rounded-lg transition-all group"
            style={{
              width: 36,
              height: 36,
              border: newItemIcon ? '2px solid var(--accent)' : '2px dashed var(--border)',
              background: newItemIcon ? 'transparent' : 'var(--surface)',
              cursor: 'pointer',
            }}
          >
            {newItemIcon ? (
              <>
                <img src={newItemIcon} alt="" aria-hidden="true" className="w-full h-full object-contain rounded-md" style={{ padding: '2px' }} />
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                  aria-hidden="true"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-0.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
            )}
          </button>
          {newItemIcon && (
            <button
              type="button"
              onClick={() => setNewItemIcon('')}
              aria-label="Retirer le logo"
              className="block w-full text-center mt-0.5 text-[10px] transition-colors hover:text-red-400"
              style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}
            >
              Retirer
            </button>
          )}
          <input
            ref={iconInputRef}
            type="file"
            accept="image/*"
            onChange={handleNewItemIconFile}
            aria-label="Uploader un logo"
            className="sr-only"
            tabIndex={-1}
          />
        </div>

        {/* Name input */}
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Nom de la compétence (ex: CSS, Docker…)"
          className="input text-sm flex-1"
          style={{ background: 'var(--surface)' }}
          aria-label={`Nom de la compétence à ajouter dans ${skill.category}`}
        />

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="btn-primary btn-sm shrink-0"
        >
          Ajouter
        </button>
      </div>

      {/* Helper hint */}
      {!newItemIcon && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          Cliquez sur l&apos;icône image à gauche pour ajouter un logo (PNG, SVG recommandé).
        </p>
      )}
    </div>
  )
}
