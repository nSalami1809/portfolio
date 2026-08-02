'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Fires a non-blocking beacon on every route change — `keepalive` lets it
// survive a fast navigation away, and it's never awaited so it can't add
// any latency to the page the visitor is actually looking at.
export default function VisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    try {
      fetch('/api/track-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // Best-effort only
    }
  }, [pathname])

  return null
}
