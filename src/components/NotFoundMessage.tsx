import Link from 'next/link'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'

// Plain conditional render, not next/navigation's notFound() — Next only
// swaps in a custom not-found.tsx for a *fully unmatched URL* (no page.tsx
// at all, resolved at the root). Calling notFound() from inside an
// already-matched page (a bad slug) falls back to Next's own generic,
// unbranded "This page could not be found" UI instead, because the
// [locale] segment's loading.tsx already commits the response to
// streaming before the page's data fetch resolves — verified by testing
// both a matched-route notFound() and a genuinely unmatched URL and
// comparing the rendered output. Rendering this directly sidesteps that
// entirely and reliably shows the site's own design.
export default function NotFoundMessage({ locale, t }: { locale: Locale; t: Dictionary['notFound'] }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <p className="section-label mb-4">{t.label}</p>
        <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>
          {t.title}
        </h1>
        <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
          {t.description}
        </p>
        <Link href={`/${locale}`} className="btn-primary">
          {t.backHome}
        </Link>
      </div>
    </div>
  )
}
