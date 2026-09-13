'use client'

import { useEffect, useRef, useState } from 'react'

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  className?: string
  once?: boolean
  duration?: number
}

// Kept small on purpose: the Layout Instability API tracks an element's
// rendered position regardless of *why* it moved, so a transform-based
// reveal still counts toward Cumulative Layout Shift even though nothing
// actually reflows. A smaller offset keeps the reveal visible while
// cutting its CLS contribution proportionally.
const OFFSETS: Record<NonNullable<FadeInProps['direction']>, string> = {
  up: 'translateY(12px)',
  down: 'translateY(-12px)',
  left: 'translateX(12px)',
  right: 'translateX(-12px)',
  none: 'none',
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

// Three-phase reveal, in this exact order for a reason:
//
//   'static'  — server render AND the first client render. NO inline opacity
//               is emitted at all, so the HTML that arrives over the wire
//               paints immediately. This is the whole point: FadeIn wraps the
//               primary content block of every public page, and serializing
//               `opacity: 0` into the SSR markup (which is what a
//               motion `initial` prop does) meant every above-the-fold
//               element stayed invisible until hydration finished —
//               directly gating LCP on the JS bundle.
//   'hidden'  — applied after mount ONLY to elements that are still off
//               screen, so hiding them is invisible to the visitor.
//   'visible' — the animated end state.
//
// Elements already on screen when the effect runs skip 'hidden' entirely:
// they were painted from the SSR HTML and must never flash back out.
export default function FadeIn({
  children,
  delay = 0,
  direction = 'up',
  className,
  once = true,
  duration = 0.55,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'static' | 'hidden' | 'visible'>('static')

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('visible')
      return
    }

    const rect = el.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    // Same -60px bias the previous IntersectionObserver margin used.
    const alreadyOnScreen = rect.top < viewportHeight - 60 && rect.bottom > 0
    if (alreadyOnScreen) {
      setPhase('visible')
      return
    }

    setPhase('hidden')

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setPhase('visible')
            if (once) io.disconnect()
          } else if (!once) {
            setPhase('hidden')
          }
        }
      },
      { rootMargin: '-60px' },
    )
    io.observe(el)

    // Safety net: some mobile browsers miss the IntersectionObserver's initial
    // read (e.g. a web font swapping in right after it fires reflows the
    // layout it just measured), which would otherwise leave content stuck at
    // opacity:0 forever since `once` never gives it a second chance. Force
    // visibility after a short delay so content is never permanently hidden.
    const t = setTimeout(() => setPhase('visible'), 1200)

    return () => {
      io.disconnect()
      clearTimeout(t)
    }
  }, [once])

  const transition = `opacity ${duration}s ${EASE} ${delay}s, transform ${duration}s ${EASE} ${delay}s`

  const style: React.CSSProperties | undefined =
    phase === 'static'
      ? undefined
      : phase === 'hidden'
        ? { opacity: 0, transform: OFFSETS[direction], transition, willChange: 'transform, opacity' }
        : { opacity: 1, transform: 'none', transition, willChange: 'transform, opacity' }

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}
