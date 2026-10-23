'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePortfolio } from '@/providers/PortfolioContext'
import ViewsWidget from '@/components/admin/ViewsWidget'
import TodayWidget from '@/components/admin/TodayWidget'
import TrendBadge, { trend } from '@/components/admin/TrendBadge'
import type { Trend } from '@/components/admin/TrendBadge'
import type { OverviewStats, ViewsStats } from '@/lib/admin-stats'
import Icon, { type IconName } from '@/components/ui/Icon'

const PILL_ICONS = {
  eye: 'eye', messages: 'mail', quotes: 'invoice', calendar: 'calendar', clock: 'clock',
  projects: 'projects', experience: 'experience', skills: 'award', testimonials: 'quote',
} as const satisfies Record<string, IconName>

function StatPill({ icon, value, label, href, t }: { icon: keyof typeof PILL_ICONS; value: number; label: string; href: string; t?: Trend }) {
  return (
    <Link
      href={href}
      aria-label={`${value} ${label}`}
      className="rounded-2xl p-3 flex items-center gap-3 transition-colors hover:bg-[var(--surface-hover)]"
      style={{ background: 'var(--surface)' }}
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-hover)', color: 'var(--text)' }}>
        <Icon name={PILL_ICONS[icon]} size={17} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-lg font-bold font-display leading-none" style={{ color: 'var(--text)' }}>{value}</p>
          {t && <TrendBadge t={t} />}
        </div>
        <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>{label}</p>
      </div>
    </Link>
  )
}

export default function AdminDashboardView({ overview, initialViews }: { overview: OverviewStats; initialViews: ViewsStats }) {
  const { data, resetAll } = usePortfolio()

  const contentStats = [
    { label: 'Projets',      value: data.projects.length,                                 href: '/admin/projects',     icon: 'projects' as const },
    { label: 'Expériences',  value: data.experiences.length,                              href: '/admin/experience',   icon: 'experience' as const },
    { label: 'Compétences',  value: data.skills.reduce((a, s) => a + s.items.length, 0), href: '/admin/skills',       icon: 'skills' as const },
    { label: 'Formations',   value: data.educations.length,                               href: '/admin/experience',   icon: 'experience' as const },
    { label: 'Témoignages',  value: data.testimonials.length,                             href: '/admin/testimonials', icon: 'testimonials' as const },
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

      <TodayWidget />

      {/* Aperçu — every KPI and content count grouped into one card */}
      <div className="card no-lift p-6">
        <p className="section-label mb-5">Aperçu</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="list">
          <StatPill icon="eye"      value={overview.views30d}         label="Vues (30j)"   href="/"                t={trend(overview.views30d, overview.viewsPrev30d)} />
          <StatPill icon="messages" value={overview.contacts30d}      label="Messages"     href="/admin/contacts"  t={trend(overview.contacts30d, overview.contactsPrev30d)} />
          <StatPill icon="quotes"   value={overview.quotes30d}        label="Devis"        href="/admin/quotes"    t={trend(overview.quotes30d, overview.quotesPrev30d)} />
          <StatPill icon="calendar" value={overview.bookings30d}      label="Rendez-vous"  href="/admin/calendar"  t={trend(overview.bookings30d, overview.bookingsPrev30d)} />
          <StatPill icon="clock"    value={overview.upcomingBookings} label="RDV à venir"  href="/admin/calendar" />
          {contentStats.map((s) => (
            <StatPill key={s.label} icon={s.icon} value={s.value} label={s.label} href={s.href} />
          ))}
        </div>
      </div>

      {/* Views analytics + quote acceptance rate */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <ViewsWidget initial={initialViews} />

        <div className="card no-lift p-5 flex flex-col">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>Taux d&apos;acceptation des devis</p>
          {overview.quoteAcceptanceRate === null ? (
            <p className="text-xs flex-1" style={{ color: 'var(--text-subtle)' }}>Pas encore de devis accepté ou refusé.</p>
          ) : (
            <>
              <p className="text-4xl font-display font-bold mb-3" style={{ color: '#008000' }}>{overview.quoteAcceptanceRate}%</p>
              <div className="w-full rounded-full overflow-hidden mb-3" style={{ height: 6, background: 'var(--surface)' }}>
                <div style={{ width: `${overview.quoteAcceptanceRate}%`, height: '100%', background: '#008000' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{overview.acceptedQuotes} devis accepté{overview.acceptedQuotes !== 1 ? 's' : ''} au total</p>
            </>
          )}
        </div>
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
                <Icon name="arrowRight" size={16} className="flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1" style={{ color: 'var(--accent)' }} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="rounded-xl p-6"
        style={{ border: '1px solid rgba(217,0,0,0.2)', background: 'rgba(217,0,0,0.04)' }}
        role="region"
        aria-label="Zone dangereuse"
      >
        <p className="text-sm font-semibold mb-1" style={{ color: '#D90000', fontFamily: 'var(--font-poppins)' }}>
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
