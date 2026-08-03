'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'

const POLL_MS = 20_000

// Short two-tone chime synthesized on the fly — no external audio asset needed.
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    ;[880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.11
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.34)
    })
    setTimeout(() => ctx.close(), 700)
  } catch {
    // Web Audio unavailable/blocked — the visual badge still updates
  }
}

export default function NotificationBell() {
  const [counts, setCounts] = useState({ unreadContacts: 0, unreadQuotes: 0, unreadBookings: 0, pendingTestimonials: 0 })
  const [open, setOpen] = useState(false)
  const prevTotal = useRef<number | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/admin-notifications')
      if (!res.ok) return
      const data = await res.json()
      const total = (data.unreadContacts ?? 0) + (data.unreadQuotes ?? 0) + (data.unreadBookings ?? 0) + (data.pendingTestimonials ?? 0)
      if (prevTotal.current !== null && total > prevTotal.current) playChime()
      prevTotal.current = total
      setCounts({
        unreadContacts: data.unreadContacts ?? 0,
        unreadQuotes: data.unreadQuotes ?? 0,
        unreadBookings: data.unreadBookings ?? 0,
        pendingTestimonials: data.pendingTestimonials ?? 0,
      })
    } catch {
      // Silent — a missed poll just gets retried on the next tick
    }
  }, [])

  useEffect(() => {
    poll() // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  const total = counts.unreadContacts + counts.unreadQuotes + counts.unreadBookings + counts.pendingTestimonials

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${total > 0 ? ` (${total} non lues)` : ''}`}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-hover)]"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {total > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-[10px] font-bold"
            style={{ minWidth: 16, height: 16, padding: '0 3px', background: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-11 z-40 w-64 rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>Notifications</p>
              </div>
              <Link
                href="/admin/contacts"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
              >
                Messages non lus
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: counts.unreadContacts > 0 ? 'var(--accent-glow)' : 'var(--bg-secondary)', color: counts.unreadContacts > 0 ? 'var(--accent)' : 'var(--text-subtle)' }}>
                  {counts.unreadContacts}
                </span>
              </Link>
              <Link
                href="/admin/quotes"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
              >
                Devis non lus
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: counts.unreadQuotes > 0 ? 'var(--accent-glow)' : 'var(--bg-secondary)', color: counts.unreadQuotes > 0 ? 'var(--accent)' : 'var(--text-subtle)' }}>
                  {counts.unreadQuotes}
                </span>
              </Link>
              <Link
                href="/admin/calendar"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
              >
                Rendez-vous non lus
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: counts.unreadBookings > 0 ? 'var(--accent-glow)' : 'var(--bg-secondary)', color: counts.unreadBookings > 0 ? 'var(--accent)' : 'var(--text-subtle)' }}>
                  {counts.unreadBookings}
                </span>
              </Link>
              <Link
                href="/admin/testimonials"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
              >
                Témoignages en attente
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: counts.pendingTestimonials > 0 ? 'var(--accent-glow)' : 'var(--bg-secondary)', color: counts.pendingTestimonials > 0 ? 'var(--accent)' : 'var(--text-subtle)' }}>
                  {counts.pendingTestimonials}
                </span>
              </Link>
              {total === 0 && (
                <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  Rien de nouveau pour le moment.
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
