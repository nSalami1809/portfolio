'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import Icon from '@/components/ui/Icon'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import '@/lib/pdfjs-worker'

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
    // react-pdf fully re-renders the PDF page's canvas on every `width`
    // change — without debouncing/thresholding, the stream of ResizeObserver
    // ticks during layout settling (fonts, the FadeIn wrapper, sidebar
    // reflow) or an actual window resize triggers a re-render per tick,
    // which reads as stutter rather than a smooth preview.
    let timer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (!width) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setContainerWidth((prev) => {
          const next = Math.min(width, 900)
          return prev !== undefined && Math.abs(prev - next) < 8 ? prev : next
        })
      }, 150)
    })
    ro.observe(el)
    return () => { ro.disconnect(); if (timer) clearTimeout(timer) }
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
            <Icon name="chevronLeft" size={14} />
          </button>
          <span>{pageNumber} / {numPages}</span>
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            aria-label="Page suivante"
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
          >
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
