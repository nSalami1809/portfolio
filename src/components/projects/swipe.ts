import { useRef, type TouchEvent } from 'react'

const MIN_DISTANCE = 50

/** Touch handlers for a horizontal swipe: left calls `next`, right calls `previous`; a mostly vertical move (a scroll) is ignored. */
export function useSwipe(next: () => void, previous: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0]
      start.current = t ? { x: t.clientX, y: t.clientY } : null
    },
    onTouchEnd: (e: TouchEvent) => {
      const t = e.changedTouches[0]
      const from = start.current
      start.current = null
      if (!from || !t) return
      const dx = t.clientX - from.x
      const dy = t.clientY - from.y
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) next()
      else previous()
    },
  }
}
