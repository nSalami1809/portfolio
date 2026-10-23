'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import PreviewErrorBoundary from './PreviewErrorBoundary'
import Icon from '@/components/ui/Icon'

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
        <Icon name="documents" size={24} style={{ color: 'var(--accent)' }} />
      </div>
      <p className="text-sm text-center px-6" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
        {t.previewUnavailable}
      </p>
      <span className="sr-only">{title}</span>
    </div>
  )
}

// Last-resort PDF fallback: the browser's own built-in PDF viewer, instead
// of our custom react-pdf renderer. Unlike react-pdf (a Web Worker + canvas
// pipeline that some mobile browsers/in-app webviews choke on), virtually
// every modern browser already renders a direct PDF URL natively — so this
// covers exactly the devices where the custom renderer just failed.
function NativePdfPreview({ fileUrl, title }: { fileUrl: string; title: string }) {
  return (
    <iframe
      src={fileUrl}
      title={title}
      className="w-full"
      style={{ height: '80vh', border: 'none', display: 'block' }}
    />
  )
}

// Picks the right client-side renderer for the file's format. On any render
// failure: PDF falls back to the browser's native viewer (NativePdfPreview);
// DOCX and the legacy .doc format (no reliable in-browser renderer for
// either) fall back to a plain "preview unavailable" card — never a blank
// or broken page.
export default function DocumentPreview({ fileUrl, fileType, title, t }: Props) {
  const [failed, setFailed] = useState(fileType === 'doc')

  if (failed) {
    return fileType === 'pdf'
      ? <NativePdfPreview fileUrl={fileUrl} title={title} />
      : <PreviewFallback title={title} t={t} />
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
