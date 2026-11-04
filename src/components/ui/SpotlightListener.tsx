'use client'

import { useEffect } from 'react'

// The soft teal light that follows the mouse over the cards marked `data-spotlight` (the painting itself is pure CSS,
// see `[data-spotlight]:hover` in globals.css). One listener for the whole site, nothing per card:
//  - only with a real mouse (a touch screen has no hover, so no listener is added at all);
//  - the position is written once per frame, straight into two CSS variables — React never re-renders.
export default function SpotlightListener() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let frame = 0
    let last: PointerEvent | null = null

    const paint = () => {
      frame = 0
      const e = last
      if (!e || !(e.target instanceof Element)) return
      const card = e.target.closest<HTMLElement>('[data-spotlight]')
      if (!card) return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`)
      card.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`)
    }
    const onMove = (e: PointerEvent) => {
      last = e
      if (!frame) frame = requestAnimationFrame(paint)
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
