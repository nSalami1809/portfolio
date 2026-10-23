'use client'

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChatBotIcon } from '@hugeicons/core-free-icons'
import Icon from '@/components/ui/Icon'

// The five places the admin goes to most on a phone, one thumb away. The full menu stays behind
// the last button. Hidden from `lg` up (the sidebar is there) and on the assistant page, where the
// message box needs the bottom of the screen.
export const BOTTOM_NAV_ITEMS = [
  { href: '/admin', label: 'Accueil', icon: 'home' },
  { href: '/admin/quotes', label: 'Devis', icon: 'invoice' },
  { href: '/admin/assistant', label: 'NemCopilotIA', icon: null },
  { href: '/admin/chats', label: 'Chats', icon: 'chat' },
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
            style={{ color: active ? 'var(--text)' : 'var(--text-subtle)', fontFamily: 'var(--font-poppins)', borderTop: `2px solid ${active ? 'var(--brand, var(--accent))' : 'transparent'}` }}
          >
            {icon === null
              ? <HugeiconsIcon icon={ChatBotIcon} size={18} strokeWidth={1.8} aria-hidden="true" />
              : <Icon name={icon} size={18} />}
            <span className="truncate max-w-full px-0.5">{label}</span>
          </Link>
        )
      })}
      <button type="button" onClick={onMenu} className={cell} style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)', borderTop: '2px solid transparent' }} aria-label="Ouvrir le menu complet">
        <Icon name="menu" size={18} />
        <span>Menu</span>
      </button>
    </nav>
  )
}
