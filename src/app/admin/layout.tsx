'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ToastProvider } from '@/components/admin/Toast'
import { PortfolioProvider } from '@/providers/PortfolioContext'
import NotificationBell from '@/components/admin/NotificationBell'
import AdminAssistantLauncher from '@/components/admin/assistant/AdminAssistantLauncher'
import CommandPalette from '@/components/admin/CommandPalette'
import MobileBottomNav, { showBottomNav } from '@/components/admin/MobileBottomNav'
import { logout } from '@/actions/auth'
import { Sidebar, DesktopSidebar, MobileSidebarPanel, SidebarLink, useSidebar } from '@/components/ui/Sidebar'
import type { SidebarLinkData } from '@/components/ui/Sidebar'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChatBotIcon, File02Icon } from '@hugeicons/core-free-icons'
import Icon from '@/components/ui/Icon'

const navItems: SidebarLinkData[] = [
  { href: '/admin', label: 'Tableau de bord', icon: <Icon name="dashboard" size={16} /> },
  { href: '/admin/personal', label: 'Profil & Réseaux', icon: <Icon name="user" size={16} /> },
  { href: '/admin/projects', label: 'Projets', icon: <Icon name="projects" size={16} /> },
  { href: '/admin/experience', label: 'Expériences & Formation', icon: <Icon name="experience" size={16} /> },
  { href: '/admin/skills', label: 'Compétences', icon: <Icon name="award" size={16} /> },
  { href: '/admin/testimonials', label: 'Témoignages', icon: <Icon name="quote" size={16} /> },
  { href: '/admin/offers', label: 'Mes Offres', icon: <Icon name="tag" size={16} /> },
  { href: '/admin/vision', label: 'Vision', icon: <Icon name="eye" size={16} /> },
  { href: '/admin/blog', label: 'Blog', icon: <Icon name="blog" size={16} /> },
  { href: '/admin/contacts', label: 'Messages', icon: <Icon name="mail" size={16} /> },
  { href: '/admin/business', label: 'Activité', icon: <Icon name="chart" size={16} /> },
  { href: '/admin/assistant', label: 'NemCopilotIA', icon: <HugeiconsIcon icon={ChatBotIcon} size={15} strokeWidth={1.75} /> },
  { href: '/admin/chats', label: 'Conversations chat', icon: <Icon name="chat" size={16} /> },
  { href: '/admin/quotes', label: 'Devis', icon: <Icon name="invoice" size={16} /> },
  { href: '/admin/documents', label: 'Documents', icon: <HugeiconsIcon icon={File02Icon} size={15} strokeWidth={1.75} /> },
  { href: '/admin/documents/signature', label: 'Signature de documents', icon: <Icon name="signature" size={16} /> },
  { href: '/admin/invoices', label: 'Factures', icon: <Icon name="receipt" size={16} /> },
  { href: '/admin/emails', label: 'Emails en échec', icon: <Icon name="mailError" size={16} /> },
  { href: '/admin/calendar', label: 'Calendrier', icon: <Icon name="calendar" size={16} /> },
  { href: '/admin/prospects', label: 'Prospects', icon: <Icon name="users" size={16} /> },
  { href: '/admin/backups', label: 'Sauvegardes', icon: <Icon name="database" size={16} /> },
  { href: '/admin/settings', label: 'Paramètres du site', icon: <Icon name="settings" size={16} /> },
]

function SidebarLogo() {
  const { open } = useSidebar()
  return (
    <div className={`h-16 flex items-center flex-shrink-0 ${open ? 'justify-start px-5' : 'justify-center px-2'}`} style={{ borderBottom: '1px solid var(--border)' }}>
      {open ? (
        <div className="min-w-0">
          <p className="font-display font-bold text-base leading-tight" style={{ color: 'var(--text)' }}>
            <span style={{ color: 'var(--accent)' }}>Admin</span> Panel
          </p>
          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            Portfolio
            <Image src="/logo-black.png" alt="" width={11} height={11} className="dark:invert" style={{ width: 11, height: 11 }} />
          </p>
        </div>
      ) : (
        <Image src="/logo-black.png" alt="" width={20} height={20} className="dark:invert" style={{ width: 20, height: 20 }} />
      )}
    </div>
  )
}

function SidebarFooter() {
  const { open } = useSidebar()
  return (
    <div className="p-3 flex-shrink-0 space-y-0.5" style={{ borderTop: '1px solid var(--border)' }}>
      <Link
        href="/"
        aria-label={!open ? 'Retour au portfolio' : undefined}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 ${!open ? 'justify-center' : ''}`}
        style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)', outlineColor: 'var(--accent)' }}
      >
        <Icon name="arrowLeft" size={15} />
        {open && <span className="whitespace-nowrap overflow-hidden">Retour au portfolio</span>}
      </Link>
      <form action={logout}>
        <button
          type="submit"
          aria-label={!open ? 'Se déconnecter' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 ${!open ? 'justify-center' : ''}`}
          style={{ color: '#D90000', fontFamily: 'var(--font-poppins)', outlineColor: '#D90000' }}
        >
          <Icon name="logout" size={15} />
          {open && <span className="whitespace-nowrap overflow-hidden">Se déconnecter</span>}
        </button>
      </form>
    </div>
  )
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 p-3 overflow-y-auto overflow-x-hidden space-y-0.5" role="navigation">
      {navItems.map((item) => (
        <SidebarLink key={item.href} link={item} isActive={pathname === item.href} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

// The editing portfolio store (fetch + poll + focus-refresh + publish) is
// scoped to /admin, where it is actually used. It used to live in the root
// layout, which made every anonymous visitor on every public page pay for a
// Server Action round trip on mount, on focus, on visibilitychange and every
// 45s. Public pages get the same data as a server-rendered prop instead
// (PortfolioStaticProvider, mounted in the root layout).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // <main> is the scroll area now (not the window): a new page starts at the top, as it did before.
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [pathname])

  // Pages d'auth — layout minimal sans sidebar
  if (pathname === '/admin/login' || pathname === '/admin/verify') {
    return <ToastProvider>{children}</ToastProvider>
  }

  return (
    <ToastProvider>
    <PortfolioProvider>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        {/* The shell is exactly one screen high (h-dvh, the dynamic height: it follows mobile
            Safari's toolbar, which a static 100vh does not). The side menu therefore stays where
            it is, and only <main> scrolls. With a min-height the whole page scrolled and took the
            menu along. */}
        <div className="h-dvh flex overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>

          {/* ── Sidebar (desktop: hover to expand · mobile: full overlay) ── */}
          <DesktopSidebar style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
            <SidebarLogo />
            <SidebarNav pathname={pathname} />
            <SidebarFooter />
          </DesktopSidebar>

          <MobileSidebarPanel className="p-0" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between h-16 px-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-display font-bold text-base" style={{ color: 'var(--text)' }}>
                <span style={{ color: 'var(--accent)' }}>Admin</span> Panel
              </p>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Fermer le menu"
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
            <SidebarNavMobile pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
            <SidebarFooterMobile onNavigate={() => setSidebarOpen(false)} />
          </MobileSidebarPanel>

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
                <Icon name="menu" size={18} />
              </button>

              <nav aria-label="Fil d'ariane" className="flex items-center gap-2 min-w-0">
                <Link href="/admin" className="text-xs transition-colors hover:text-[var(--accent)] shrink-0" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  Admin
                </Link>
                {pathname !== '/admin' && (
                  <>
                    <Icon name="chevronRight" size={10} style={{ color: 'var(--border)', flexShrink: 0 }} />
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                      {navItems.find((n) => n.href === pathname)?.label ?? ''}
                    </p>
                  </>
                )}
              </nav>

              <div className="ml-auto flex-shrink-0 flex items-center gap-2">
                <CommandPalette pages={navItems.map(({ href, label }) => ({ href, label }))} />
                <NotificationBell />
              </div>
            </header>

            {/* Content */}
            <main ref={mainRef} className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden ${showBottomNav(pathname) ? 'pb-24 lg:pb-8' : ''}`}>
              <div className={pathname === '/admin/assistant' ? 'max-w-7xl mx-auto' : 'max-w-5xl mx-auto'}>
                {children}
              </div>
            </main>
          </div>
        </div>
      </Sidebar>
      <AdminAssistantLauncher />
      <MobileBottomNav pathname={pathname} onMenu={() => setSidebarOpen(true)} />
    </PortfolioProvider>
    </ToastProvider>
  )
}

// Mobile panel always shows full labels (it's a full-width overlay, not a
// hover rail), so it renders the nav/footer directly instead of reusing the
// desktop SidebarLink (which ties its label visibility to the hover state).
function SidebarNavMobile({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav className="flex-1 p-3 overflow-y-auto space-y-0.5" role="navigation">
      {navItems.map(({ href, label, icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: isActive ? 'var(--accent-glow)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font-poppins)',
            }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {icon}
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarFooterMobile({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="p-3 flex-shrink-0 space-y-0.5" style={{ borderTop: '1px solid var(--border)' }}>
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-[var(--surface-hover)]"
        style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}
      >
        <Icon name="arrowLeft" size={15} />
        Retour au portfolio
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 hover:bg-red-500/10"
          style={{ color: '#D90000', fontFamily: 'var(--font-poppins)' }}
        >
          <Icon name="logout" size={15} />
          Se déconnecter
        </button>
      </form>
    </div>
  )
}
