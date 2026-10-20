'use client'

import Link from 'next/link'

// The five places the admin goes to most on a phone, one thumb away. The full menu stays behind
// the last button. Hidden from `lg` up (the sidebar is there) and on the assistant page, where the
// message box needs the bottom of the screen.
export const BOTTOM_NAV_ITEMS = [
  { href: '/admin', label: 'Accueil', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/admin/quotes', label: 'Devis', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8' },
  { href: '/admin/assistant', label: 'NemCopilotIA', icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z' },
  { href: '/admin/chats', label: 'Chats', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
] as const

/** Whether a path belongs to a bottom-nav entry (the home entry only matches exactly). */
export function isActiveItem(href: string, pathname: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`)
}

export function showBottomNav(pathname: string): boolean {
  return pathname !== '/admin/assistant'
}

export default function MobileBottomNav({ pathname, onMenu }: { pathname: string; onMenu: () => void }) {
  if (!showBottomNav(pathname)) return null
  const cell = 'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors'
  return (
    <nav
      aria-label="Navigation rapide"
      data-testid="bottom-nav"
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 flex"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {BOTTOM_NAV_ITEMS.map(({ href, label, icon }) => {
        const active = isActiveItem(href, pathname)
        return (
          <Link
            key={href} href={href} aria-current={active ? 'page' : undefined}
            className={cell}
            style={{ color: active ? 'var(--text)' : 'var(--text-subtle)', fontFamily: 'var(--font-poppins)', borderTop: `2px solid ${active ? 'var(--accent)' : 'transparent'}` }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
            <span className="truncate max-w-full px-0.5">{label}</span>
          </Link>
        )
      })}
      <button type="button" onClick={onMenu} className={cell} style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)', borderTop: '2px solid transparent' }} aria-label="Ouvrir le menu complet">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></svg>
        <span>Menu</span>
      </button>
    </nav>
  )
}
