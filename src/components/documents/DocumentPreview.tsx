'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import PreviewErrorBoundary from './PreviewErrorBoundary'

// Dynamically imported (ssr: false) so react-pdf/pdfjs-dist and docx-preview
// — both non-trivial in size — are only ever downloaded on a document's own
// detail page, never added to the rest of the site's bundle.
const PdfPreview = dynamic(() => import('./PdfPreview'), {
  ssr: false,
  loading: () => <PreviewSkeleton />,
})
const DocxPreview = dynamic(() => import('./DocxPreview'), {
  ssr: false,
  loading: () => <PreviewSkeleton />,
})

interface Props {
  fileUrl: string
  fileType: 'pdf' | 'docx' | 'doc'
  title: string
  t: Dictionary['documents']
}

function PreviewSkeleton() {
  return (
    <div className="w-full flex items-center justify-center py-20" aria-hidden="true">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
    </div>
  )
}

function PreviewFallback({ title, t }: { title: string; t: Dictionary['documents'] }) {
  return (
    <div
      className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 py-20"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-glow)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }} aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
        </svg>
      </div>
      <p className="text-sm text-center px-6" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
        {t.previewUnavailable}
      </p>
      <span className="sr-only">{title}</span>
    </div>
  )
}

// Picks the right client-side renderer for the file's format and falls back
// to a plain "preview unavailable" card (never a blank/broken page) on any
// render failure or for formats with no reliable in-browser renderer (.doc).
export default function DocumentPreview({ fileUrl, fileType, title, t }: Props) {
  const [failed, setFailed] = useState(fileType === 'doc')

  if (failed) {
    return <PreviewFallback title={title} t={t} />
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <PreviewErrorBoundary onError={() => setFailed(true)}>
        {fileType === 'pdf' ? (
          <PdfPreview fileUrl={fileUrl} onError={() => setFailed(true)} />
        ) : (
          <DocxPreview fileUrl={fileUrl} onError={() => setFailed(true)} />
        )}
      </PreviewErrorBoundary>
    </div>
  )
}
