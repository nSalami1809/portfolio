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
  /** The page is drawn on screen (used to swap the instant picture for the real viewer) */
  onRendered?: () => void
  /** The file, already on its way (started at the same time as the engine, so the two downloads overlap); null = could not, read it from the URL */
  prefetched?: Promise<Uint8Array | null>
}

// A phone has no use for selectable text in a preview (the download is one tap away) and the text layer is a lot of DOM to build.
const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export default function PdfPreview({ fileUrl, onError, onRendered, prefetched }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>()
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [file, setFile] = useState<string | { data: Uint8Array } | null>(prefetched ? null : fileUrl)
  const [textLayer] = useState(() => !coarsePointer())
  // Drawing at more than 2x the screen's pixels is invisible and costs a third more on a 3x phone
  const [dpr] = useState(() => Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1))

  useEffect(() => {
    if (!prefetched) return
    let live = true
    prefetched.then((bytes) => { if (live) setFile(bytes ? { data: bytes.slice() } : fileUrl) })
    return () => { live = false }
  }, [prefetched, fileUrl])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // react-pdf fully re-renders the PDF page's canvas on every `width`
    // change — without debouncing/thresholding, the stream of ResizeObserver
    // ticks during layout settling (fonts, the FadeIn wrapper, sidebar
    // reflow) or an actual window resize triggers a re-render per tick,
    // which reads as stutter rather than a smooth preview.
    let timer: ReturnType<typeof setTimeout> | null = null
    // First measure right away: the page is only drawn once its width is known, so it is
    // never drawn at its natural size (wider than a phone) and then drawn again.
    const first = el.getBoundingClientRect().width
    if (first) setContainerWidth(Math.min(first, 900))
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
    <div ref={containerRef} className="w-full min-w-0 overflow-hidden">
      {file && <Document
        file={file}
        onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPageNumber(1) }}
        onLoadError={onError}
        loading={<div className="py-20 text-center text-sm" style={{ color: 'var(--text-subtle)' }} />}
        error={<div />}
      >
        {containerWidth && (
          <Page
            pageNumber={pageNumber}
            width={containerWidth}
            renderAnnotationLayer={false}
            renderTextLayer={textLayer}
            devicePixelRatio={dpr}
            onRenderSuccess={() => onRendered?.()}
            onLoadError={onError}
          />
        )}
      </Document>}

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
