'use client'

import { useEffect } from 'react'

/**
 * Closes an overlay on Escape. Only binds while `active` is true, so several
 * overlays can use it without every one of them listening all the time.
 */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, onEscape])
}
