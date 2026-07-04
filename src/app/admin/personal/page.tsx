'use client'

import { useState, useEffect, useRef } from 'react'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import ImageUpload from '@/components/admin/ImageUpload'
import type { PersonalInfo, SocialLinks } from '@/types'

export default function AdminPersonal() {
  const { data, updatePersonal, updateSocials } = usePortfolio()
  const toast = useToast()
  const [personal, setPersonal] = useState<PersonalInfo>(data.personal)
  const [socials, setSocials] = useState<SocialLinks>(data.socials)
  const [dirty, setDirty] = useState(false)

  // Sync local state once context finishes hydrating from localStorage/MongoDB
  const localOwned = useRef(false)
  useEffect(() => {
    if (!localOwned.current) { setPersonal(data.personal); setDirty(false) }
  }, [data.personal])
  useEffect(() => {
    if (!localOwned.current) { setSocials(data.socials); setDirty(false) }
  }, [data.socials])

  const handlePersonal = (patch: Partial<PersonalInfo>) => { localOwned.current = true; setPersonal((p) => ({ ...p, ...patch })); setDirty(true) }
  const handleSocials = (key: string, val: string) => { localOwned.current = true; setSocials((p) => ({ ...p, [key]: val })); setDirty(true) }

  const handleSave = () => {
    updatePersonal(personal)
    updateSocials(socials)
    setDirty(false)
    toast('Profil sauvegardé')
  }

  const SOCIALS: [string, string, string][] = [
    ['LinkedIn', 'linkedin', 'https://linkedin.com/in/…'],
    ['GitHub', 'github', 'https://github.com/…'],
    ['Facebook', 'facebook', 'https://facebook.com/…'],
    ['Instagram', 'instagram', 'https://instagram.com/…'],
  ]

  return (
    <div className="space-y-6" style={{ maxWidth: '680px' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Profil & Réseaux</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Ces informations apparaissent sur toutes les pages du portfolio.
          </p>
        </div>
        {dirty && (
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', fontFamily: 'var(--font-poppins)' }}>
            Modifications non sauvegardées
          </span>
        )}
      </div>

      {/* Photo */}
      <section className="card no-lift p-6">
        <p className="section-label mb-5">Photo de profil</p>
        <ImageUpload
          value={personal.photo}
          onChange={(v) => handlePersonal({ photo: v })}
          size="lg"
          shape="circle"
          placeholder="Photo de profil"
          label=""
        />
      </section>

      {/* Infos */}
      <section className="card no-lift p-6">
        <p className="section-label mb-5">Informations personnelles</p>
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="pi-name">Nom complet</label>
            <input id="pi-name" className="input" value={personal.name} onChange={(e) => handlePersonal({ name: e.target.value })} placeholder="Prénom Nom" />
          </div>
          <div>
            <label className="field-label" htmlFor="pi-role">Titre / Métier</label>
            <input id="pi-role" className="input" value={personal.role} onChange={(e) => handlePersonal({ role: e.target.value })} placeholder="Développeur Fullstack & DevOps" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="pi-email">Email de contact</label>
              <input id="pi-email" className="input" type="email" value={personal.email} onChange={(e) => handlePersonal({ email: e.target.value })} placeholder="vous@email.com" />
            </div>
            <div>
              <label className="field-label" htmlFor="pi-location">Localisation</label>
              <input id="pi-location" className="input" value={personal.location} onChange={(e) => handlePersonal({ location: e.target.value })} placeholder="Ville, Gabon — Remote" />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="pi-bio">Biographie</label>
            <textarea
              id="pi-bio"
              value={personal.bio}
              onChange={(e) => handlePersonal({ bio: e.target.value })}
              rows={4}
              placeholder="Quelques mots sur vous…"
              className="input"
              style={{ resize: 'vertical', minHeight: '100px' }}
            />
          </div>
        </div>
      </section>

      {/* Réseaux */}
      <section className="card no-lift p-6">
        <p className="section-label mb-5">Réseaux sociaux</p>
        <div className="space-y-4">
          {SOCIALS.map(([label, key, ph]) => (
            <div key={key}>
              <label className="field-label" htmlFor={`social-${key}`}>{label}</label>
              <input
                id={`social-${key}`}
                className="input"
                value={socials[key] ?? ''}
                onChange={(e) => handleSocials(key, e.target.value)}
                placeholder={ph}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4 pb-2">
        <button onClick={handleSave} className="btn-primary btn-sm">
          Sauvegarder les modifications
        </button>
        {!dirty && (
          <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Tout est sauvegardé
          </span>
        )}
      </div>
    </div>
  )
}
