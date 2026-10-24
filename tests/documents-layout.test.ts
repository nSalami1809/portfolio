import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (...p: string[]) => readFileSync(join(__dirname, '..', 'src', ...p), 'utf8')
const list = read('app', '[locale]', 'documents', 'DocumentsView.tsx')
const detail = read('app', '[locale]', 'documents', '[slug]', 'DocumentDetailView.tsx')
const pdf = read('components', 'documents', 'PdfPreview.tsx')

describe('documents list: the whole cover is shown', () => {
  it('shows the portrait first page entire, not cropped to a landscape band', () => {
    expect(list).not.toMatch(/aspect-video/)
    expect(list).not.toMatch(/object-cover/)
    expect(list).toMatch(/max-h-full max-w-full/)
    expect(list).toMatch(/width=\{600\}\s+height=\{849\}/)
  })

  it('keeps the cards inside a phone screen and the summaries whole', () => {
    expect(list).toMatch(/grid grid-cols-1 sm:grid-cols-2/)
    expect(list).toMatch(/className="min-w-0"/)
    expect(list).not.toMatch(/line-clamp/)
  })
})

describe('document page: nothing overflows a phone', () => {
  it('uses a shrinkable column, so the PDF page cannot widen the layout', () => {
    expect(detail).toMatch(/grid grid-cols-1 lg:grid-cols-\[minmax\(0,1fr\)_320px\]/)
    expect(detail).toMatch(/<div className="min-w-0">/)
    expect(detail).not.toMatch(/line-clamp/)
  })

  it('draws the PDF page only once its width is known, from the first measure', () => {
    expect(pdf).toMatch(/getBoundingClientRect\(\)\.width/)
    expect(pdf).toMatch(/\{containerWidth && \(\s*<Page/)
    expect(pdf).toMatch(/min-w-0 overflow-hidden/)
  })
})
