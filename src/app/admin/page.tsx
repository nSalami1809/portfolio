'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePortfolio } from '@/providers/PortfolioContext'
import BarChart from '@/components/admin/BarChart'

interface ActivityStats {
  contacts30d: number
  quotes30d: number
  bookings30d: number
  views30d: number
  views24h: number
  contactsPrev30d: number
  quotesPrev30d: number
  bookingsPrev30d: number
  viewsPrev30d: number
  upcomingBookings: number
  acceptedQuotes: number
  quoteAcceptanceRate: number | null
  viewsByDay: { date: string; count: number }[]
}

type Trend = { dir: 'up' | 'down' | 'new' | 'flat'; pct: number | null }

function trend(current: number, previous: number): Trend {
  if (previous === 0) return { dir: current > 0 ? 'new' : 'flat', pct: null }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { dir: 'flat', pct: 0 }
  return { dir: pct > 0 ? 'up' : 'down', pct: Math.abs(pct) }
}

function TrendBadge({ t }: { t: Trend }) {
  if (t.dir === 'flat') return null
  const color = t.dir === 'down' ? '#EF4444' : '#10B981'
  const label = t.dir === 'new' ? 'Nouveau' : `${t.dir === 'up' ? '+' : '-'}${t.pct}%`
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ color, background: `${color}1A` }}
    >
      {t.dir === 'up' && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>}
      {t.dir === 'down' && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>}
      {label}
    </span>
  )
}

function KpiCard({ label, value, href, color, t }: { label: string; value: number; href: string; color: string; t?: Trend }) {
  return (
    <Link href={href} role="listitem" aria-label={`${value} ${label}`}>
      <div className="card p-5 h-full cursor-pointer" style={{ borderLeft: `3px solid ${color}` }}>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-3xl font-bold font-display leading-none" style={{ color }}>{value}</p>
          {t && <TrendBadge t={t} />}
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>{label}</p>
      </div>
    </Link>
  )
}

export default function AdminDashboard() {
  const { data, resetAll } = usePortfolio()
  const [activity, setActivity] = useState<ActivityStats | null>(null)

  useEffect(() => {
    fetch('/api/admin-stats')
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json) setActivity(json) })
      .catch(() => {})
  }, [])

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

      {/* Activity — business signals from the last 30 days, with trend vs the previous 30 */}
      {activity && (
        <div className="space-y-4">
          <p className="section-label">Activité (30 derniers jours vs période précédente)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" role="list">
            <KpiCard label="Vues (30j)"   value={activity.views30d}    href="/"                 color="#3B82F6" t={trend(activity.views30d, activity.viewsPrev30d)} />
            <KpiCard label="Messages"     value={activity.contacts30d} href="/admin/contacts"   color="#06B6D4" t={trend(activity.contacts30d, activity.contactsPrev30d)} />
            <KpiCard label="Devis"        value={activity.quotes30d}   href="/admin/quotes"     color="#8B5CF6" t={trend(activity.quotes30d, activity.quotesPrev30d)} />
            <KpiCard label="Rendez-vous"  value={activity.bookings30d} href="/admin/calendar"   color="#F59E0B" t={trend(activity.bookings30d, activity.bookingsPrev30d)} />
            <KpiCard label="RDV à venir"  value={activity.upcomingBookings} href="/admin/calendar" color="#EC4899" />
          </div>

          <div className="grid lg:grid-cols-[1fr,280px] gap-4">
            {/* Views chart */}
            <div className="card no-lift p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>Vues sur 14 jours</p>
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{activity.views24h} aujourd&apos;hui</p>
              </div>
              <BarChart data={activity.viewsByDay} />
            </div>

            {/* Quote acceptance rate */}
            <div className="card no-lift p-5 flex flex-col">
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>Taux d&apos;acceptation des devis</p>
              {activity.quoteAcceptanceRate === null ? (
                <p className="text-xs flex-1" style={{ color: 'var(--text-subtle)' }}>Pas encore de devis accepté ou refusé.</p>
              ) : (
                <>
                  <p className="text-4xl font-display font-bold mb-3" style={{ color: '#10B981' }}>{activity.quoteAcceptanceRate}%</p>
                  <div className="w-full rounded-full overflow-hidden mb-3" style={{ height: 6, background: 'var(--surface)' }}>
                    <div style={{ width: `${activity.quoteAcceptanceRate}%`, height: '100%', background: '#10B981' }} />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{activity.acceptedQuotes} devis accepté{activity.acceptedQuotes !== 1 ? 's' : ''} au total</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
            <Image src={data.personal.photo} alt={data.personal.name} width={56} height={56} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
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
