'use client'

import { useEffect } from 'react'

// Registered after window.load (not immediately) so the SW's own network
// activity never competes with the page's own critical resources — keeps
// this a zero-cost addition to first-load performance.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
