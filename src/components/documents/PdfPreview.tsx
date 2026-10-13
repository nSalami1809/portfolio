'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Self-hosted (public/pdfjs/, copied at install time by
// scripts/copy-pdfjs-worker.mjs) rather than fetched from a CDN — same
// reasoning as Monaco's assets.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'

interface Props {
  fileUrl: string
  onError: () => void
}

export default function PdfPreview({ fileUrl, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>()
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(Math.min(width, 900))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full">
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPageNumber(1) }}
        onLoadError={onError}
        loading={<div className="py-20 text-center text-sm" style={{ color: 'var(--text-subtle)' }} />}
        error={<div />}
      >
        <Page
          pageNumber={pageNumber}
          width={containerWidth}
          renderAnnotationLayer={false}
          renderTextLayer
          onLoadError={onError}
        />
      </Document>

      {numPages > 1 && (
        <div
          className="flex items-center justify-center gap-4 py-3 text-sm"
          style={{ borderTop: '1px solid var(--border)', fontFamily: 'var(--font-poppins)', color: 'var(--text-muted)' }}
        >
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            aria-label="Page précédente"
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span>{pageNumber} / {numPages}</span>
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            aria-label="Page suivante"
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      )}
    </div>
  )
}
