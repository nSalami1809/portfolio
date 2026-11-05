import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import DocumentPreview, { canAutoLoad } from '@/components/documents/DocumentPreview'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { warmupScript } from '@/lib/document-warmup'
import { PDFJS_WORKER_URL } from '@/lib/pdfjs-worker-url'

const root = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')
const t = getDictionary('fr').documents
const THUMB = 'https://x.public.blob.vercel-storage.com/images/1-thumbnail-abc.webp'
const FILE = 'https://x.public.blob.vercel-storage.com/documents/1-doc.pdf'
const render = (props: Record<string, unknown>) => renderToStaticMarkup(h(DocumentPreview, { fileUrl: FILE, fileType: 'pdf', title: 'Guide Docker', t, ...props } as never))

describe('a PDF document page, as the server sends it', () => {
  const html = render({ thumbnailUrl: THUMB })

  it('has the first page on screen from the start (a small picture), without waiting for any script', () => {
    expect(html).toContain('data-doc-poster')
    expect(html).toContain(THUMB)
    expect(html).toContain('alt="Guide Docker"')
    expect(html).toContain('loading="eager"')
  })

  it('does not load the PDF engine or the file yet, and offers the full document with a button', () => {
    expect(html).not.toContain('canvas')
    expect(html).not.toContain('react-pdf')
    expect(html).not.toContain(FILE) // the PDF itself is only requested by the viewer
    expect(html).toContain(`>${t.previewRead}<`)
  })

  it('keeps the old behaviour when the document has no picture, and for Word files', () => {
    expect(render({})).not.toContain('data-doc-poster')
    expect(render({ fileType: 'docx', thumbnailUrl: THUMB })).not.toContain('data-doc-poster')
  })

  it('the picture does not shift the page when it arrives (its size is declared)', () => {
    expect(html).toMatch(/width="600"/)
    expect(html).toMatch(/height="849"/)
  })
})

describe('when the full viewer may start by itself', () => {
  it('yes on a normal connection and device, including when the browser tells nothing', () => {
    expect(canAutoLoad({})).toBe(true)
    expect(canAutoLoad({ connection: { effectiveType: '4g' }, deviceMemory: 8 })).toBe(true)
  })

  it('no with the data saver, on 2G/3G, or under 2 GB of memory: the reader taps instead', () => {
    expect(canAutoLoad({ connection: { saveData: true } })).toBe(false)
    for (const effectiveType of ['slow-2g', '2g', '3g']) expect(canAutoLoad({ connection: { effectiveType } }), effectiveType).toBe(false)
    expect(canAutoLoad({ deviceMemory: 1 })).toBe(false)
    expect(canAutoLoad({ deviceMemory: 0.5 })).toBe(false)
    expect(canAutoLoad({ deviceMemory: 2 })).toBe(true)
  })
})

describe('the viewer behind the picture', () => {
  const preview = read('src', 'components', 'documents', 'DocumentPreview.tsx')
  const pdf = read('src', 'components', 'documents', 'PdfPreview.tsx')

  it('starts by itself once the browser is idle (not waiting for the reader to scroll), or on a tap', () => {
    expect(preview).toContain('window.requestIdleCallback(begin, { timeout: 500 })')
    expect(preview).toContain('canAutoLoad(navigator')
    expect(preview).toContain('onClick={begin}')
    expect(preview).not.toContain('IntersectionObserver')
  })

  it('downloads the file and the worker at the same time as the engine, instead of one after the other', () => {
    expect(preview).toContain('p = prefetchPdf(url)')
    expect(preview).toContain('fetch(PDFJS_WORKER_URL)')
    expect(preview).toContain('PREFETCH_MAX_BYTES')
    expect(pdf).toContain('prefetched?: Promise<Uint8Array | null>')
    expect(pdf).toContain('{ data: bytes.slice() } : fileUrl') // if the early download fails the viewer reads the URL itself
  })

  it('does not move the page when the real viewer replaces the picture: same width, status on top of the picture', () => {
    expect(preview).toContain('maxWidth: 900')
    expect(preview).toContain('absolute inset-x-0 bottom-0')
    expect(preview).not.toContain('flex-col items-center gap-4')
  })

  it('is lighter on a phone: drawing capped at 2x, no text layer on a touch screen', () => {
    expect(pdf).toContain('Math.min(2,')
    expect(pdf).toContain('devicePixelRatio={dpr}')
    expect(pdf).toContain("matchMedia('(pointer: coarse)')")
    expect(pdf).toContain('renderTextLayer={textLayer}')
  })

  it('stays out of sight and out of the flow while it loads, and replaces the picture only once its first page is drawn', () => {
    expect(preview).toMatch(/position: 'absolute'[\s\S]*?visibility: 'hidden'/)
    expect(preview).toContain("onRendered={() => setMode('ready')}")
    expect(pdf).toContain('onRenderSuccess={() => onRendered?.()}')
  })

  it('still falls back to the browser viewer if the PDF engine fails', () => {
    expect(preview).toContain('NativePdfPreview')
    expect(preview).toMatch(/onError=\{\(\) => setFailed\(true\)\}/)
  })
})

describe('the PDF engine file', () => {
  it('has a URL that carries the library version, and is cached for a year', () => {
    expect(read('src', 'lib', 'pdfjs-worker-url.ts')).toContain('/pdfjs/pdf.worker.min.mjs?v=${process.env.NEXT_PUBLIC_PDFJS_VERSION')
    expect(read('src', 'lib', 'pdfjs-worker.ts')).toContain('workerSrc = PDFJS_WORKER_URL')
    const config = read('next.config.ts')
    expect(config).toContain('NEXT_PUBLIC_PDFJS_VERSION: pdfjsVersion')
    expect(config).toContain("source: '/pdfjs/:path*'")
    expect(config).toContain('public, max-age=31536000, immutable')
  })
})

describe('texts', () => {
  it('exist in French and in English', () => {
    expect(getDictionary('fr').documents.previewRead).toBe('Afficher le document complet')
    expect(getDictionary('en').documents.previewRead).toBe('Show the full document')
  })
})

describe('the detail page hands the picture to the preview', () => {
  it('passes thumbnailUrl', () => {
    expect(read('src', 'app', '[locale]', 'documents', '[slug]', 'DocumentDetailView.tsx')).toContain('thumbnailUrl={document.thumbnailUrl}')
  })
})

describe('the warm-up script in the page of a PDF document', () => {
  // Runs the script the way a browser would, with a fake document and navigator, and returns the preload tags it adds
  const run = (nav: Record<string, unknown>) => {
    const added: { rel?: string; as?: string; href?: string; crossOrigin?: string; attrs: Record<string, string> }[] = []
    const doc = {
      createElement: () => {
        const el = { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v } } as (typeof added)[number] & { setAttribute: (k: string, v: string) => void }
        return el
      },
      head: { appendChild: (el: (typeof added)[number]) => { added.push(el) } },
    }
    new Function('navigator', 'document', warmupScript(FILE))(nav, doc)
    return added
  }

  it('preloads the file and the engine worker, at low priority, on a normal connection', () => {
    const tags = run({ connection: { effectiveType: '4g' }, deviceMemory: 8 })
    expect(tags.map((x) => x.href)).toEqual([FILE, PDFJS_WORKER_URL])
    expect(tags.every((x) => x.rel === 'preload' && x.as === 'fetch' && x.crossOrigin === 'anonymous' && x.attrs.fetchpriority === 'low')).toBe(true)
    expect(run({}).length).toBe(2) // a browser that tells nothing
  })

  it('applies exactly the same rule as canAutoLoad: nothing on a data saver, 2G/3G or a small device', () => {
    const cases: Record<string, unknown>[] = [
      {}, { connection: { effectiveType: '4g' }, deviceMemory: 8 }, { connection: { saveData: true } }, { connection: { effectiveType: 'slow-2g' } },
      { connection: { effectiveType: '2g' } }, { connection: { effectiveType: '3g' } }, { deviceMemory: 1 }, { deviceMemory: 0.5 }, { deviceMemory: 2 },
    ]
    for (const nav of cases) expect(run(nav).length > 0, JSON.stringify(nav)).toBe(canAutoLoad(nav as never))
  })

  it('never breaks the page, whatever the browser gives it', () => {
    expect(() => new Function('navigator', 'document', warmupScript(FILE))(undefined, undefined)).not.toThrow()
  })

  it('cannot be broken out of by a file name', () => {
    const script = warmupScript('https://x/a</script><script>alert(1)</script>.pdf')
    expect(script).not.toContain('</script>')
  })

  it('is only put in the page of a PDF whose size is known and small enough to be fetched whole', () => {
    const page = read('src', 'app', '[locale]', 'documents', '[slug]', 'page.tsx')
    expect(page).toContain("document.fileType === 'pdf' && document.fileSize > 0 && document.fileSize <= PREFETCH_MAX_BYTES")
    expect(page).toContain('warmupScript(document.fileUrl)')
  })

  it('the viewer asks for the file with the same request as the preload tag, so the browser reuses it', () => {
    const preview = read('src', 'components', 'documents', 'DocumentPreview.tsx')
    expect(preview).toContain('await fetch(url)')
    expect(preview).not.toContain("credentials: 'omit'")
  })
})
