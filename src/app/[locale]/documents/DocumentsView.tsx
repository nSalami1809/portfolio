'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { m, AnimatePresence } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import { File02Icon } from '@hugeicons/core-free-icons'
import FadeIn from '@/components/animations/FadeIn'
import type { PortfolioDocument } from '@/types'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import Icon from '@/components/ui/Icon'

// A grid card only needs these fields (see documents/page.tsx).
export type DocumentCardData = Pick<PortfolioDocument, 'slug' | 'title' | 'description' | 'category' | 'fileType' | 'fileSize' | 'thumbnailUrl'>

interface Props {
  documents: DocumentCardData[]
  locale: Locale
  t: Dictionary['documents']
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`
}

export default function DocumentsView({ documents, locale, t }: Props) {
  const categories = useMemo(
    () => [t.all, ...Array.from(new Set(documents.map((d) => d.category)))],
    [documents, t.all],
  )
  const [active, setActive] = useState(t.all)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const byCategory = active === t.all ? documents : documents.filter((d) => d.category === active)
    const q = query.trim().toLowerCase()
    if (!q) return byCategory
    return byCategory.filter((d) =>
      d.title.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q),
    )
  }, [documents, active, t.all, query])

  return (
    <div className="relative">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20">
      {/* Hero */}
      <div className="mb-20">
        <FadeIn>
          <p className="section-label mb-3">{t.label}</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
            {t.title}
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)', maxWidth: 500 }}>
            {t.subtitle}
          </p>
        </FadeIn>
      </div>

      {/* Search */}
      <FadeIn>
        <div className="relative mb-6 max-w-sm">
          <Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-subtle)' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchAria}
            className="input"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn>
        <div className="flex flex-wrap gap-2 mb-12" role="group" aria-label={t.filterAria}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              aria-pressed={active === cat}
              className="px-5 py-2 text-sm font-medium transition-all duration-200"
              style={{
                fontFamily: 'var(--font-poppins)',
                background: active === cat ? 'var(--accent)' : 'var(--surface)',
                color: active === cat ? 'var(--accent-contrast)' : 'var(--text-muted)',
                border: active === cat ? '1px solid var(--accent)' : '1px solid var(--border)',
                transform: active === cat ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Grid */}
      <m.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((doc, i) => (
            <m.div
              key={doc.slug}
              className="min-w-0"
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.3) }}
            >
              <Link href={`/${locale}/documents/${doc.slug}`} className="card block p-6 h-full group">
                {/* Category & file type */}
                <div className="flex items-center justify-between mb-5">
                  <span className="tag">{doc.category}</span>
                  <span className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                    {doc.fileType.toUpperCase()}{formatSize(doc.fileSize) ? ` · ${formatSize(doc.fileSize)}` : ''}
                  </span>
                </div>

                {/* Thumbnail / icon */}
                {doc.thumbnailUrl ? (
                  // The thumbnail is the PDF's whole first page (portrait): it is shown entire, centred
                  // in a fixed-height panel, never cropped to a landscape band.
                  <div
                    className="flex items-center justify-center w-full h-[22rem] sm:h-[26rem] p-4 mb-5"
                    style={{ background: 'var(--surface-hover)' }}
                  >
                    <Image
                      src={doc.thumbnailUrl}
                      alt={doc.title}
                      width={600}
                      height={849}
                      loading="lazy"
                      // Already a small, pre-sized webp generated at upload
                      // time — skip Next's on-demand resize/re-encode (a
                      // cold first-hit per breakpoint) and serve it straight
                      // from Blob's own CDN, which is already fast and cached.
                      unoptimized
                      className="h-auto w-auto max-h-full max-w-full"
                      style={{ border: '1px solid var(--border)' }}
                    />
                  </div>
                ) : (
                  <div
                    className="w-full h-[22rem] sm:h-[26rem] mb-5 flex items-center justify-center overflow-hidden"
                    style={{ background: 'var(--surface-hover)' }}
                    aria-hidden="true"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-glow)' }}>
                      <HugeiconsIcon icon={File02Icon} size={20} strokeWidth={1.5} color="var(--accent)" />
                    </div>
                  </div>
                )}

                <h2
                  className="font-display font-semibold text-xl mb-3 break-words transition-colors duration-200 group-hover:text-[var(--accent)]"
                  style={{ color: 'var(--text)' }}
                >
                  {doc.title}
                </h2>
                <p className="text-sm leading-relaxed mb-5 break-words whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
                  {doc.description}
                </p>

                <div
                  className="flex items-center gap-2 text-sm font-medium transition-all duration-200 reveal-on-hover opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1"
                  style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}
                  aria-hidden="true"
                >
                  {t.viewDocument}
                  <Icon name="arrowRight" size={14} />
                </div>
              </Link>
            </m.div>
          ))}
        </AnimatePresence>
      </m.div>

      {filtered.length === 0 && (
        <div className="py-20 text-center" style={{ color: 'var(--text-muted)' }}>
          {query.trim() ? t.noResults : t.empty}
        </div>
      )}
      </div>
    </div>
  )
}
