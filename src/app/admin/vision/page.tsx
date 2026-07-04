'use client'

import { useState } from 'react'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import type { VisionData } from '@/types'

const F = ({ label, req }: { label: string; req?: boolean }) => (
  <label className="field-label">{label}{req && <span style={{ color: '#EF4444' }}> *</span>}</label>
)

function ParagraphList({
  label,
  items,
  onChange,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  const set = (i: number, v: string) => {
    const next = [...items]
    next[i] = v
    onChange(next)
  }
  const add = () => onChange([...items, ''])
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <F label={label} />
        <button
          type="button"
          onClick={add}
          className="btn-secondary btn-xs"
        >
          + Paragraphe
        </button>
      </div>
      {items.map((p, i) => (
        <div key={i} className="flex gap-2">
          <textarea
            value={p}
            onChange={(e) => set(i, e.target.value)}
            rows={3}
            className="input flex-1 resize-y"
            placeholder={`Paragraphe ${i + 1}…`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="btn-danger btn-icon self-start mt-0"
            aria-label="Supprimer ce paragraphe"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          Aucun paragraphe — cliquez sur « + Paragraphe » pour en ajouter.
        </p>
      )}
    </div>
  )
}

export default function AdminVision() {
  const { data, updateVision } = usePortfolio()
  const toast = useToast()
  const [form, setForm] = useState<VisionData>({ ...data.vision })
  const [dirty, setDirty] = useState(false)

  const update = (patch: Partial<VisionData>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const save = () => {
    if (!form.quote.trim()) return toast('La citation est obligatoire', 'error')
    updateVision(form)
    setDirty(false)
    toast('Vision sauvegardée')
  }

  const setValeur = (i: number, field: 'title' | 'text', v: string) => {
    const valeurs = [...form.valeurs]
    valeurs[i] = { ...valeurs[i], [field]: v }
    update({ valeurs })
  }

  const addValeur = () => update({ valeurs: [...form.valeurs, { title: '', text: '' }] })
  const removeValeur = (i: number) => update({ valeurs: form.valeurs.filter((_, j) => j !== i) })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Vision</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Citation, philosophie, approche et valeurs fondamentales · Sauvegarde automatique
          </p>
        </div>
        <button
          onClick={save}
          disabled={!dirty}
          className="btn-primary btn-sm"
        >
          Sauvegarder
        </button>
      </div>

      {/* Citation */}
      <div className="card no-lift p-5 space-y-3">
        <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>Citation principale</h2>
        <div>
          <F label="Citation" req />
          <textarea
            value={form.quote}
            onChange={(e) => update({ quote: e.target.value })}
            rows={3}
            className="input resize-y"
            placeholder="Un bon code n'est pas…"
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            Affichée en italique dans la section hero de la page Vision.
          </p>
        </div>
      </div>

      {/* Philosophie */}
      <div className="card no-lift p-5">
        <h2 className="font-display font-semibold text-base mb-4" style={{ color: 'var(--text)' }}>Section Philosophie</h2>
        <ParagraphList
          label="Paragraphes"
          items={form.philosophie}
          onChange={(philosophie) => update({ philosophie })}
        />
      </div>

      {/* Approche */}
      <div className="card no-lift p-5">
        <h2 className="font-display font-semibold text-base mb-4" style={{ color: 'var(--text)' }}>Section Approche</h2>
        <ParagraphList
          label="Paragraphes"
          items={form.approche}
          onChange={(approche) => update({ approche })}
        />
      </div>

      {/* Valeurs */}
      <div className="card no-lift p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>Valeurs fondamentales</h2>
          <button type="button" onClick={addValeur} className="btn-secondary btn-xs">
            + Valeur
          </button>
        </div>
        {form.valeurs.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            Aucune valeur — cliquez sur « + Valeur » pour en ajouter.
          </p>
        )}
        {form.valeurs.map((v, i) => (
          <div key={i} className="p-4 rounded-xl space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>
                VALEUR {i + 1}
              </span>
              <button type="button" onClick={() => removeValeur(i)} className="btn-danger btn-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
            </div>
            <div>
              <F label="Titre" req />
              <input
                type="text"
                value={v.title}
                onChange={(e) => setValeur(i, 'title', e.target.value)}
                className="input"
                placeholder="Clarté…"
              />
            </div>
            <div>
              <F label="Description" req />
              <textarea
                value={v.text}
                onChange={(e) => setValeur(i, 'text', e.target.value)}
                rows={2}
                className="input resize-y"
                placeholder="Un système simple bien compris…"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Save bottom */}
      {dirty && (
        <div className="flex justify-end">
          <button onClick={save} className="btn-primary btn-sm">Sauvegarder</button>
        </div>
      )}
    </div>
  )
}
