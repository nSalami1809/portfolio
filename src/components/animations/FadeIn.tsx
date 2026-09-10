'use client'

import { m, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  className?: string
  once?: boolean
  duration?: number
}

export default function FadeIn({
  children,
  delay = 0,
  direction = 'up',
  className,
  once = true,
  duration = 0.55,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: '-60px' })

  // Safety net: some mobile browsers miss the IntersectionObserver's initial
  // read (e.g. a web font swapping in right after it fires reflows the
  // layout it just measured), which would otherwise leave content stuck at
  // opacity:0 forever since `once` never gives it a second chance. Force
  // visibility after a short delay so content is never permanently hidden.
  const [forceVisible, setForceVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setForceVisible(true), 1200)
    return () => clearTimeout(t)
  }, [])

  const visible = isInView || forceVisible

  // Kept small on purpose: the Layout Instability API tracks an element's
  // rendered position regardless of *why* it moved, so a transform-based
  // reveal still counts toward Cumulative Layout Shift even though nothing
  // actually reflows. A smaller offset keeps the reveal visible while
  // cutting its CLS contribution proportionally.
  const offsets = {
    up: { y: 12, x: 0 },
    down: { y: -12, x: 0 },
    left: { x: 12, y: 0 },
    right: { x: -12, y: 0 },
    none: { x: 0, y: 0 },
  }

  return (
    <m.div
      ref={ref}
      className={className}
      suppressHydrationWarning
      style={{ willChange: 'transform, opacity' }}
      initial={{ opacity: 0, ...offsets[direction] }}
      animate={visible ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  )
}
