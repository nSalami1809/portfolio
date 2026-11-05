'use client'

import { useEffect, useRef } from 'react'

/** "10+" → { prefix: '', n: 10, suffix: '+' }; "100%" → { prefix: '', n: 100, suffix: '%' }; "Bac+5" is not a count. */
export function parseCountable(value: string): { prefix: string; n: number; suffix: string } | null {
  const m = /^([^\d]*)(\d{1,6})([^\d]*)$/.exec(value.trim())
  if (!m) return null
  // A figure with letters around it ("Bac+5", "24h", "1 mois") is a label or a duration, not a quantity to count up to
  if (/[A-Za-zÀ-ÿ]/.test(m[1]) || /[A-Za-zÀ-ÿ]/.test(m[3])) return null
  return { prefix: m[1], n: Number(m[2]), suffix: m[3] }
}

const DURATION = 1100
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

interface Props {
  value: string
  className?: string
  style?: React.CSSProperties
}

// A figure that counts up when it scrolls into view. The server HTML (and the first client render) carry the FINAL
// value, so nothing is hidden, nothing shifts and search engines read the real number. Like FadeIn, only a figure that
// is counted up from 0 when it comes into view (one already on screen at load counts at once).
// No React state: the text is written straight into the node on each frame, so counting never re-renders anything.
export default function CountUp({ value, className, style }: Props) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    const parsed = parseCountable(value)
    if (!el || !parsed) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') return
    const { prefix, n, suffix } = parsed
    const write = (v: number) => { el.textContent = `${prefix}${Math.round(v)}${suffix}` }
    write(0)

    let raf = 0
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / DURATION)
        write(n * easeOutCubic(p))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    io.observe(el)

    // leaving the page or changing the value puts the real figure back at once
    return () => { io.disconnect(); cancelAnimationFrame(raf); el.textContent = value }
  }, [value])

  return (
    <>
      <span ref={ref} aria-hidden="true" className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{value}</span>
      <span className="sr-only">{value}</span>
    </>
  )
}
