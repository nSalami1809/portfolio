'use client'

import Link from 'next/link'
import type { PortfolioDocument } from '@/types'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import FadeIn from '@/components/animations/FadeIn'
import ShareButton from '@/components/ui/ShareButton'
import DocumentPreview from '@/components/documents/DocumentPreview'
import Icon from '@/components/ui/Icon'

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`
}

export default function DocumentDetailView({ document, locale, t }: { document: PortfolioDocument; locale: Locale; t: Dictionary['documents'] }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
      {/* Back */}
      <FadeIn>
        <Link
          href={`/${locale}/documents`}
          className="inline-flex items-center gap-2 text-sm font-medium mb-16 transition-colors duration-200 hover:text-[var(--accent)]"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
        >
          <Icon name="arrowLeft" size={16} />
          {t.allDocumentsLink}
        </Link>
      </FadeIn>

      {/* grid-cols-1 = minmax(0,1fr): without it the single column grows to the PDF page's natural width and the summary and the page overflow the phone's screen */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-12 items-start">
        {/* Main */}
        <div className="min-w-0">
          <FadeIn delay={0.05}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tag">{document.category}</span>
                <span className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  {document.fileType.toUpperCase()} · {formatSize(document.fileSize)}
                </span>
              </div>
              <ShareButton
                title={document.title}
                text={document.description}
                url={`/${locale}/documents/${document.slug}`}
                label={t.share}
                copiedLabel={t.shareCopied}
                copyLinkLabel={t.shareCopyLink}
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1
              className="font-display font-bold mb-6 break-words"
              style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', color: 'var(--text)' }}
            >
              {document.title}
            </h1>
          </FadeIn>

          <FadeIn delay={0.15}>
            <p className="text-base sm:text-lg leading-relaxed mb-8 break-words whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
              {document.description}
            </p>
          </FadeIn>

          <FadeIn delay={0.18}>
            <a
              href={`/api/documents/${document.slug}/download`}
              className="btn-primary text-base px-8 py-4 mb-10 max-sm:w-full max-sm:justify-center"
            >
              <Icon name="upload" size={16} />
              {t.download}
            </a>
          </FadeIn>

          {/* Preview */}
          <FadeIn delay={0.2}>
            <DocumentPreview fileUrl={document.fileUrl} fileType={document.fileType} title={document.title} t={t} />
          </FadeIn>
        </div>

        {/* Sidebar */}
        <FadeIn delay={0.3} direction="left" className="space-y-4">
          <div className="card p-5 space-y-3">
            <a
              href={`/api/documents/${document.slug}/download`}
              className="btn-primary w-full justify-center text-sm py-3"
            >
              <Icon name="upload" size={14} />
              {t.download}
            </a>
          </div>

          {/* Meta */}
          <div className="card p-5 space-y-4">
            <p className="section-label">{t.infoLabel}</p>
            {[
              { label: t.category, value: document.category },
              { label: t.date, value: document.date },
              { label: t.fileType, value: document.fileType.toUpperCase() },
              { label: t.fileSize, value: formatSize(document.fileSize) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{label}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Nav documents */}
          <div className="card p-5">
            <Link
              href={`/${locale}/documents`}
              className="flex items-center justify-between text-sm font-medium transition-colors duration-200 hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
            >
              {t.viewAllDocuments}
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
