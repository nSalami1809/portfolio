'use client'

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

function MarqueeRow({ items, direction, locale, verifiedLabel }: { items: Testimonial[]; direction: 'left' | 'right'; locale: Locale; verifiedLabel: string }) {
  // With very few testimonials, a single pass is narrower than the viewport
  // on wide screens — the loop would then show a big empty gap once the
  // (too-short) track scrolls past. Repeat the set until it's comfortably
  // wider than any realistic desktop viewport, then double that for the
  // seamless -50% loop.
  const unitWidth = items.length * CARD_UNIT
  const repeats = Math.max(1, Math.ceil(MIN_TRACK_WIDTH / unitWidth))
  const base = Array.from({ length: repeats }, () => items).flat()
  const track = [...base, ...base]
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

export default function TestimonialsMarquee({ testimonials, locale, verifiedLabel = 'Vérifié' }: { testimonials: Testimonial[]; locale: Locale; verifiedLabel?: string }) {
  const reducedMotion = usePrefersReducedMotion()

  // Motion-sensitive visitors get a plain, fully-readable grid instead of
  // the auto-scrolling rows — same content, no animation to fight with.
  if (reducedMotion) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((tm) => <TestimonialCard key={tm.id} tm={tm} locale={locale} verifiedLabel={verifiedLabel} />)}
      </div>
    )
  }

  const row1 = testimonials.filter((_, i) => i % 2 === 0)
  const row2 = testimonials.filter((_, i) => i % 2 === 1)

  return (
    <div className="space-y-4">
      <MarqueeRow items={row1} direction="left" locale={locale} verifiedLabel={verifiedLabel} />
      {row2.length > 0 && <MarqueeRow items={row2} direction="right" locale={locale} verifiedLabel={verifiedLabel} />}
    </div>
  )
}
