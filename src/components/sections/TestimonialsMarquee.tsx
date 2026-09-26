'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import StarRating from '@/components/ui/StarRating'
import type { Testimonial } from '@/types'
import type { Locale } from '@/lib/i18n/locale'

function VerifiedBadge({ slug, locale, label }: { slug: string; locale: Locale; label: string }) {
  return (
    <Link
      href={`/${locale}/projects/${slug}`}
      className="inline-flex items-center gap-1 text-xs font-medium mb-2.5 hover:underline"
      style={{ color: '#008000' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
      </svg>
      {label}
    </Link>
  )
}

function TestimonialCard({ tm, fixedWidth, locale, verifiedLabel }: { tm: Testimonial; fixedWidth?: boolean; locale: Locale; verifiedLabel: string }) {
  return (
    <div
      className={`rounded-2xl p-5 ${fixedWidth ? 'flex-shrink-0' : 'h-full'}`}
      style={{ width: fixedWidth ? 320 : undefined, background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        {tm.avatar ? (
          <Image src={tm.avatar} alt={tm.name} width={40} height={40} loading="lazy" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-base"
            style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
          >
            {tm.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{tm.name}</p>
          {(tm.role || tm.company) && (
            <p className="text-xs truncate" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
              {[tm.role, tm.company].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div className="mb-2.5">
        <StarRating rating={tm.rating ?? 5} />
      </div>
      {tm.projectSlug && <VerifiedBadge slug={tm.projectSlug} locale={locale} label={verifiedLabel} />}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        &ldquo;{tm.text}&rdquo;
      </p>
    </div>
  )
}

const CARD_UNIT = 320 + 16 // fixed card width + the row's flex gap
const MIN_TRACK_WIDTH = 3200 // wide enough that even a single testimonial fills an ultra-wide monitor with no visible gap
const SPEED_PX_PER_S = 70
const TOUCH_RESUME_MS = 2500 // after a finger lifts, wait this long (swipe momentum) before drifting again

type RowProps = { items: Testimonial[]; direction: 'left' | 'right'; locale: Locale; verifiedLabel: string }

function buildTrack(items: Testimonial[]) {
  // With very few testimonials, a single pass is narrower than the viewport
  // on wide screens — the loop would then show a big empty gap once the
  // (too-short) track scrolls past. Repeat the set until it's comfortably
  // wider than any realistic desktop viewport, then double that for the
  // seamless loop.
  const unitWidth = items.length * CARD_UNIT
  const repeats = Math.max(1, Math.ceil(MIN_TRACK_WIDTH / unitWidth))
  const base = Array.from({ length: repeats }, () => items).flat()
  return { base, track: [...base, ...base] }
}

// Mouse / trackpad: a pure CSS transform loop, paused on hover.
function MarqueeRow({ items, direction, locale, verifiedLabel }: RowProps) {
  const { base, track } = buildTrack(items)
  const durationS = Math.max(10, Math.round((base.length * CARD_UNIT) / SPEED_PX_PER_S))

  return (
    <div className="marquee-viewport">
      <div
        className="marquee-track flex gap-4"
        style={{ animation: `marquee-${direction} ${durationS}s linear infinite` }}
      >
        {track.map((tm, i) => (
          <TestimonialCard key={`${tm.id}-${i}`} tm={tm} fixedWidth locale={locale} verifiedLabel={verifiedLabel} />
        ))}
      </div>
    </div>
  )
}

// Touch screens: the row is a real horizontally scrollable strip, so a swipe
// works natively (with the browser's own momentum), and a small
// requestAnimationFrame loop keeps it drifting on its own — same look as the
// desktop marquee. Touching the strip hands control to the finger; the drift
// resumes a moment after it lifts. The track holds two identical copies, so
// wrapping the position by exactly one copy's width is invisible, both for the
// automatic drift and for a swipe that reaches either end.
function TouchMarqueeRow({ items, direction, locale, verifiedLabel }: RowProps) {
  const { base, track } = buildTrack(items)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const held = useRef(false)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = scrollerRef.current
    const trackEl = el?.firstElementChild
    if (!el || !trackEl) return

    // Width of exactly one copy of the set (card widths + gaps), measured
    // rather than assumed so it stays right at any font size or gap.
    const period = () => {
      const first = trackEl.children[0] as HTMLElement | undefined
      const second = trackEl.children[base.length] as HTMLElement | undefined
      return first && second ? second.offsetLeft - first.offsetLeft : 0
    }
    const wrap = (x: number, p: number) => (x >= p ? x - p : x < 0 ? x + p : x)

    let pos = direction === 'right' ? period() : 0
    el.scrollLeft = pos
    let last = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000 // a backgrounded tab must not lurch forward
      last = now
      const p = period()
      if (p > 0) {
        if (held.current) {
          // The finger (or its momentum) owns the position: follow it, and
          // keep it inside one period so a long swipe can't run off the end.
          const wrapped = wrap(el.scrollLeft, p)
          if (wrapped !== el.scrollLeft) el.scrollLeft = wrapped
          pos = wrapped
        } else {
          pos = wrap(pos + (direction === 'left' ? 1 : -1) * SPEED_PX_PER_S * dt, p)
          el.scrollLeft = pos
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
    }
  }, [base.length, direction])

  const hold = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    held.current = true
  }
  const release = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => { held.current = false }, TOUCH_RESUME_MS)
  }

  return (
    <div ref={scrollerRef} className="marquee-scroller" onTouchStart={hold} onTouchEnd={release} onTouchCancel={release}>
      <div className="marquee-track flex gap-4">
        {track.map((tm, i) => (
          <TestimonialCard key={`${tm.id}-${i}`} tm={tm} fixedWidth locale={locale} verifiedLabel={verifiedLabel} />
        ))}
      </div>
    </div>
  )
}

// No hovering pointer = a touch screen (see TouchMarqueeRow).
function useNoHoverPointer() {
  const [noHover, setNoHover] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(hover: none)')
    setNoHover(mq.matches) // eslint-disable-line react-hooks/set-state-in-effect
    const onChange = () => setNoHover(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return noHover
}

export default function TestimonialsMarquee({ testimonials, locale, verifiedLabel = 'Vérifié' }: { testimonials: Testimonial[]; locale: Locale; verifiedLabel?: string }) {
  const reducedMotion = usePrefersReducedMotion()
  const noHover = useNoHoverPointer()

  // Motion-sensitive visitors get a plain, fully-readable grid instead of the
  // auto-scrolling rows.
  if (reducedMotion) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((tm) => <TestimonialCard key={tm.id} tm={tm} locale={locale} verifiedLabel={verifiedLabel} />)}
      </div>
    )
  }

  const row1 = testimonials.filter((_, i) => i % 2 === 0)
  const row2 = testimonials.filter((_, i) => i % 2 === 1)
  const Row = noHover ? TouchMarqueeRow : MarqueeRow

  return (
    <div className="space-y-4">
      <Row items={row1} direction="left" locale={locale} verifiedLabel={verifiedLabel} />
      {row2.length > 0 && <Row items={row2} direction="right" locale={locale} verifiedLabel={verifiedLabel} />}
    </div>
  )
}
