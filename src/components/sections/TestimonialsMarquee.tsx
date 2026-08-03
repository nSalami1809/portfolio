'use client'

import Image from 'next/image'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import StarRating from '@/components/ui/StarRating'
import type { Testimonial } from '@/types'

function TestimonialCard({ tm, fixedWidth }: { tm: Testimonial; fixedWidth?: boolean }) {
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
      <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
        &ldquo;{tm.text}&rdquo;
      </p>
    </div>
  )
}

function MarqueeRow({ items, direction }: { items: Testimonial[]; direction: 'left' | 'right' }) {
  // Duplicated so the -50% loop is seamless; duration scales with row length
  // so every card keeps roughly the same on-screen speed regardless of count.
  const durationS = Math.max(18, items.length * 6)
  const doubled = [...items, ...items]

  return (
    <div className="marquee-viewport">
      <div
        className="marquee-track flex gap-4"
        style={{ animation: `marquee-${direction} ${durationS}s linear infinite` }}
      >
        {doubled.map((tm, i) => (
          <TestimonialCard key={`${tm.id}-${i}`} tm={tm} fixedWidth />
        ))}
      </div>
    </div>
  )
}

export default function TestimonialsMarquee({ testimonials }: { testimonials: Testimonial[] }) {
  const reducedMotion = usePrefersReducedMotion()

  // Motion-sensitive visitors get a plain, fully-readable grid instead of
  // the auto-scrolling rows — same content, no animation to fight with.
  if (reducedMotion) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((tm) => <TestimonialCard key={tm.id} tm={tm} />)}
      </div>
    )
  }

  const row1 = testimonials.filter((_, i) => i % 2 === 0)
  const row2 = testimonials.filter((_, i) => i % 2 === 1)

  return (
    <div className="space-y-4">
      <MarqueeRow items={row1} direction="left" />
      {row2.length > 0 && <MarqueeRow items={row2} direction="right" />}
    </div>
  )
}
