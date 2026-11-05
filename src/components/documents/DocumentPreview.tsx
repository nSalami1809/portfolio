'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import PreviewErrorBoundary from './PreviewErrorBoundary'
import Icon from '@/components/ui/Icon'
import { PDFJS_WORKER_URL } from '@/lib/pdfjs-worker-url'
import { PREFETCH_MAX_BYTES } from '@/lib/document-warmup'

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
  /** The first page as a small picture, made at upload time: shown at once while the real viewer is still on its way */
  thumbnailUrl?: string
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

type Hints = { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number }

/**
 * May the full viewer (the PDF engine, 390 KB compressed, then the file) start loading by itself when the preview comes
 * near the screen? Not on a data-saver, a 2G/3G connection or a device with under 2 GB of memory: there the reader gets
 * the picture of the first page at once and taps to load the rest.
 */
export function canAutoLoad(nav: Hints): boolean {
  const c = nav.connection
  if (c?.saveData) return false
  if (c?.effectiveType && /^(slow-2g|2g|3g)$/.test(c.effectiveType)) return false
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) return false
  return true
}

/** Downloads the PDF whole, now, while the engine that will read it is still being downloaded; null = let the viewer do it. */
async function prefetchPdf(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url) // same request as the preload tag the server put in the page, so it is reused
    if (!res.ok || Number(res.headers.get('content-length') ?? 0) > PREFETCH_MAX_BYTES) { void res.body?.cancel(); return null }
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

// The files already on their way or downloaded, by URL (two at most: this is a head start, not a store)
const prefetches = new Map<string, Promise<Uint8Array | null>>()

/** Network only, no work for the processor: the file and the engine's worker start downloading right away. Safe to call twice. */
function startPrefetch(url: string): Promise<Uint8Array | null> {
  let p = prefetches.get(url)
  if (!p) {
    if (prefetches.size >= 2) prefetches.clear()
    p = prefetchPdf(url)
    prefetches.set(url, p)
    void fetch(PDFJS_WORKER_URL).catch(() => {}) // warms the cache the engine will read the worker from
  }
  return p
}

// A PDF is read in two steps. 1) The first page, a ~30 KB picture sent with the page itself, is on screen at once.
// 2) The real viewer (page by page) loads behind it, hidden, and replaces the picture only when its first page is drawn.
// The engine (a script, then its worker) and the file are downloaded AT THE SAME TIME, right when the page opens, so
// they are usually ready before the reader scrolls down to them; before, nothing was visible until the engine, the worker,
// the file and the drawing had come one after the other (about ten seconds on a mid-range phone with a slow connection).
// The picture has the size of the real page and the status sits on top of it, so the swap does not move the page.
function PdfWithPoster({ fileUrl, title, poster, t, onError }: { fileUrl: string; title: string; poster: string; t: Dictionary['documents']; onError: () => void }) {
  const [mode, setMode] = useState<'poster' | 'loading' | 'ready'>('poster')

  // Mounts the viewer (the engine's script, then the drawing: that is the processor's part)
  const begin = useCallback(() => {
    startPrefetch(fileUrl)
    setMode((m) => (m === 'poster' ? 'loading' : m))
  }, [fileUrl])

  // On a normal connection and device the viewer starts by itself once the browser is idle; on a data saver, 2G/3G or a small
  // device it waits for a tap.
  useEffect(() => {
    if (mode !== 'poster' || !canAutoLoad(navigator as Navigator & Hints)) return
    startPrefetch(fileUrl)
    // short deadline: the page's own start-up (hydration) is over within a moment, and waiting for a long idle gap cost seconds
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(begin, { timeout: 500 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(begin, 500)
    return () => window.clearTimeout(id)
  }, [mode, fileUrl, begin])

  return (
    <div className="relative mx-auto" style={{ maxWidth: 900 }}>
      {mode !== 'ready' && (
        <div data-doc-poster className="relative" style={{ background: 'var(--surface-hover)' }}>
          <Image
            src={poster}
            alt={title}
            width={600}
            height={849}
            loading="eager"
            // already a small pre-sized webp (see the documents list): served straight from the storage CDN
            unoptimized
            className="block h-auto w-full"
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
            {mode === 'poster' ? (
              <button type="button" className="btn-primary text-sm px-5 py-3 max-sm:w-full max-sm:justify-center" onClick={begin}>
                <Icon name="documents" size={14} />
                {t.previewRead}
              </button>
            ) : (
              <p role="status" className="flex items-center gap-2 px-4 py-2 text-sm" style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', fontFamily: 'var(--font-poppins)' }}>
                <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} aria-hidden="true" />
                {t.previewLoading}
              </p>
            )}
          </div>
        </div>
      )}
      {mode !== 'poster' && (
        // While it loads the viewer is laid out (so it can measure its width) but out of sight and out of the flow
        <div
          style={mode === 'ready' ? undefined : { position: 'absolute', top: 0, left: 0, right: 0, visibility: 'hidden', pointerEvents: 'none' }}
          aria-hidden={mode === 'ready' ? undefined : true}
        >
          <PdfPreview fileUrl={fileUrl} prefetched={prefetches.get(fileUrl)} onError={onError} onRendered={() => setMode('ready')} />
        </div>
      )}
    </div>
  )
}

// Picks the right client-side renderer for the file's format. On any render
// failure: PDF falls back to the browser's native viewer (NativePdfPreview);
// DOCX and the legacy .doc format (no reliable in-browser renderer for
// either) fall back to a plain "preview unavailable" card — never a blank
// or broken page.
export default function DocumentPreview({ fileUrl, fileType, title, thumbnailUrl, t }: Props) {
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
          thumbnailUrl
            ? <PdfWithPoster fileUrl={fileUrl} title={title} poster={thumbnailUrl} t={t} onError={() => setFailed(true)} />
            : <PdfPreview fileUrl={fileUrl} onError={() => setFailed(true)} />
        ) : (
          <DocxPreview fileUrl={fileUrl} onError={() => setFailed(true)} />
        )}
      </PreviewErrorBoundary>
    </div>
  )
}
