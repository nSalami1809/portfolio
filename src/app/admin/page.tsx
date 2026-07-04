'use client'

import Link from 'next/link'
import { usePortfolio } from '@/providers/PortfolioContext'

export default function AdminDashboard() {
  const { data, resetAll } = usePortfolio()

  const stats = [
    { label: 'Projets',      value: data.projects.length,                                      href: '/admin/projects',      color: '#8B5CF6' },
    { label: 'Expériences',  value: data.experiences.length,                                   href: '/admin/experience',    color: '#06B6D4' },
    { label: 'Compétences',  value: data.skills.reduce((a, s) => a + s.items.length, 0),       href: '/admin/skills',        color: '#10B981' },
    { label: 'Formations',   value: data.educations.length,                                    href: '/admin/experience',    color: '#F59E0B' },
    { label: 'Témoignages',  value: data.testimonials.length,                                  href: '/admin/testimonials',  color: '#EC4899' },
  ]

  const quickLinks = [
    { href: '/admin/personal',     label: 'Modifier le profil',       desc: 'Nom, bio, photo, réseaux' },
    { href: '/admin/projects',     label: 'Gérer les projets',        desc: 'Ajouter, modifier, supprimer' },
    { href: '/admin/experience',   label: 'Gérer les expériences',    desc: 'Parcours & formations' },
    { href: '/admin/skills',       label: 'Gérer les compétences',    desc: 'Stack technique' },
    { href: '/admin/testimonials', label: 'Gérer les témoignages',    desc: 'Avis clients & collaborateurs' },
    { href: '/admin/settings',     label: 'Paramètres du site',       desc: 'Thème par défaut, sécurité' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-3xl mb-1" style={{ color: 'var(--text)' }}>Tableau de bord</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Gérez votre portfolio depuis cet espace d&apos;administration.
        </p>
      </div>

      {/* Stats — keep hover lift since they're Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" role="list">
        {stats.map(({ label, value, href, color }) => (
          <Link key={label} href={href} role="listitem" aria-label={`${value} ${label}`}>
            <div
              className="card p-5 h-full cursor-pointer"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <p className="text-3xl font-bold font-display mb-1 leading-none" style={{ color }}>
                {value}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                {label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Profile preview — no lift (static) */}
      <div className="card no-lift p-6">
        <p className="section-label mb-4">Profil actuel</p>
        <div className="flex items-center gap-4">
          {data.personal.photo ? (
            <img src={data.personal.photo} alt={data.personal.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-xl flex-shrink-0"
              style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
              aria-hidden="true"
            >
              {data.personal.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-lg truncate" style={{ color: 'var(--text)' }}>
              {data.personal.name}
            </p>
            <p className="text-sm truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              {data.personal.role}
            </p>
          </div>
          <Link href="/admin/personal" className="btn-secondary btn-sm shrink-0">
            Modifier
          </Link>
        </div>
      </div>

      {/* Quick links — keep hover lift (clickable) */}
      <div>
        <p className="section-label mb-4">Accès rapides</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {quickLinks.map(({ href, label, desc }) => (
            <Link key={href} href={href} aria-label={label}>
              <div className="card p-5 flex items-center justify-between gap-4 cursor-pointer group">
                <div className="min-w-0">
                  <p className="font-medium text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                    {label}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  className="flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: 'var(--accent)' }}
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="rounded-xl p-6"
        style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}
        role="region"
        aria-label="Zone dangereuse"
      >
        <p className="text-sm font-semibold mb-1" style={{ color: '#EF4444', fontFamily: 'var(--font-poppins)' }}>
          Zone dangereuse
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Réinitialiser toutes les données du portfolio (revient aux valeurs par défaut). Cette action est irréversible.
        </p>
        <button
          onClick={() => { if (confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) resetAll() }}
          className="btn-danger btn-sm"
          aria-label="Réinitialiser toutes les données du portfolio"
        >
          Réinitialiser les données
        </button>
      </div>
    </div>
  )
}
