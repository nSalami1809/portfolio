'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ToastProvider } from '@/components/admin/Toast'
import { logout } from '@/actions/auth'

const navItems = [
  { href: '/admin', label: 'Tableau de bord', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/admin/personal', label: 'Profil & Réseaux', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/admin/projects', label: 'Projets', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { href: '/admin/experience', label: 'Expériences & Formation', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/admin/skills', label: 'Compétences', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { href: '/admin/testimonials', label: 'Témoignages', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { href: '/admin/vision', label: 'Vision', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  { href: '/admin/blog', label: 'Blog', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
  { href: '/admin/contacts', label: 'Messages', icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6' },
  { href: '/admin/settings', label: 'Paramètres du site', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Pages d'auth — layout minimal sans sidebar
  if (pathname === '/admin/login' || pathname === '/admin/verify') {
    return <ToastProvider>{children}</ToastProvider>
  }

  return (
    <ToastProvider>
      <div className="min-h-screen flex" style={{ background: 'var(--bg-secondary)' }}>

        {/* ── Sidebar ── */}
        <aside
          className={`fixed lg:sticky top-0 h-screen w-64 flex-shrink-0 flex flex-col z-40 transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
          aria-label="Navigation admin"
        >
          {/* Logo */}
          <div className="px-5 h-16 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="font-display font-bold text-base leading-tight" style={{ color: 'var(--text)' }}>
                <span style={{ color: 'var(--accent)' }}>Admin</span> Panel
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                Portfolio NS
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Fermer le menu"
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 overflow-y-auto space-y-0.5" role="navigation">
            {navItems.map(({ href, label, icon }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                  style={{
                    background: isActive ? 'var(--accent-glow)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-poppins)',
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
                    <path d={icon}/>
                  </svg>
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer: back + logout */}
          <div className="p-3 flex-shrink-0 space-y-0.5" style={{ borderTop: '1px solid var(--border)' }}>
            <Link
              href="/"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Retour au portfolio
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-red-500/10"
                style={{ color: '#EF4444', fontFamily: 'var(--font-poppins)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                Se déconnecter
              </button>
            </form>
          </div>
        </aside>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setSidebarOpen(false)}
            role="presentation"
            aria-hidden="true"
          />
        )}

        {/* ── Main ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Topbar */}
          <header
            className="sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 h-16 flex-shrink-0"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text)', flexShrink: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <nav aria-label="Fil d'ariane" className="flex items-center gap-2 min-w-0">
              <Link href="/admin" className="text-xs transition-colors hover:text-[var(--accent)] shrink-0" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                Admin
              </Link>
              {pathname !== '/admin' && (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--border)', flexShrink: 0 }} aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                    {navItems.find((n) => n.href === pathname)?.label ?? ''}
                  </p>
                </>
              )}
            </nav>
          </header>

          {/* Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
            <div className="max-w-5xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
