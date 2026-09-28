'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'

interface Props {
  title: string
  text?: string
  // Absolute or relative — resolved against location.origin if relative.
  url: string
  label: string
  copiedLabel: string
  copyLinkLabel: string
  className?: string
  // Icon only, no visible text — for tight spaces (a card, a list row).
  iconOnly?: boolean
  // The button sits inside a wrapping <Link>: a click must not trigger the
  // link's navigation (both the trigger and the dropdown are covered).
  stopPropagation?: boolean
}

const WHATSAPP = (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
const X = (url: string, text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
const LINKEDIN = (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
const EMAIL = (url: string, title: string, text: string) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`

// A minimal "icon + label" share action — matches a plain header link rather
// than a boxed button. On a phone it opens the OS share sheet; elsewhere it
// drops a small menu (copy link, WhatsApp, X, LinkedIn, email).
export default function ShareButton({ title, text, url, label, copiedLabel, copyLinkLabel, className = '', iconOnly = false, stopPropagation = false }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const absoluteUrl = typeof window !== 'undefined' ? new URL(url, window.location.origin).toString() : url
  const shareText = text ?? title

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.preventDefault()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: absoluteUrl })
      } catch {
        // Cancelled by the visitor — nothing to do.
      }
      return
    }
    setOpen((v) => !v)
  }

  const copyLink = async (e: React.MouseEvent) => {
    if (stopPropagation) e.preventDefault()
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard unavailable — the menu's other links still work.
    }
  }

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={
          iconOnly
            ? 'flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200 hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] cursor-pointer'
            : 'inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 hover:text-[var(--accent)] cursor-pointer'
        }
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
        aria-haspopup={open ? 'menu' : undefined}
        aria-expanded={open || undefined}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" />
          <line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
        </svg>
        {!iconOnly && label}
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            role="menu"
            className="absolute right-0 top-7 z-40 w-52 overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--glass-shadow)' }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={copyLink}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[var(--surface-hover)] cursor-pointer"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              {copied ? copiedLabel : copyLinkLabel}
            </button>
            {[
              { label: 'WhatsApp', href: WHATSAPP(absoluteUrl, shareText), icon: <path d="M3 21l1.65-4.95A9 9 0 1112 21a8.96 8.96 0 01-4.5-1.2L3 21z" /> },
              { label: 'X', href: X(absoluteUrl, shareText), icon: <path d="M4 4l16 16M20 4L4 20" /> },
              { label: 'LinkedIn', href: LINKEDIN(absoluteUrl), icon: <><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /><path d="M10 9v12M10 13a4 4 0 018 0v8" /></> },
              { label: 'Email', href: EMAIL(absoluteUrl, title, shareText), icon: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 6l10 7 10-7" /></> },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{item.icon}</svg>
                {item.label}
              </a>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
