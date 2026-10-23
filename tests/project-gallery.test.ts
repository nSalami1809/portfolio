import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAX_PROJECT_IMAGES, cleanGallery, galleryCapacity, isBlobImageUrl, moveItem, projectImages, sanitizeProjectGalleries,
} from '@/lib/project-gallery'

const blob = (n: number | string) => `https://abc123.public.blob.vercel-storage.com/projects/${n}-shot.jpg`

describe('which URLs a gallery accepts', () => {
  it('takes Vercel Blob public URLs over https and nothing else', () => {
    expect(isBlobImageUrl(blob(1))).toBe(true)
    for (const bad of [
      'http://abc123.public.blob.vercel-storage.com/a.jpg',
      'https://evil.example.com/a.jpg',
      'https://public.blob.vercel-storage.com.evil.example/a.jpg',
      'https://evil.example/.public.blob.vercel-storage.com/a.jpg',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      '/uploads/a.jpg',
      '',
      null,
      undefined,
      42,
    ]) expect(isBlobImageUrl(bad), String(bad)).toBe(false)
  })
})

describe('the limit of six images, cover included', () => {
  it('leaves room for five more next to a cover, six without one', () => {
    expect(MAX_PROJECT_IMAGES).toBe(6)
    expect(galleryCapacity(blob('cover'))).toBe(5)
    expect(galleryCapacity(undefined)).toBe(6)
    expect(galleryCapacity('')).toBe(6)
  })

  it('cuts a longer list at the limit, keeping the first ones in order', () => {
    const many = Array.from({ length: 9 }, (_, i) => blob(i))
    expect(cleanGallery(many, blob('cover'))).toEqual(many.slice(0, 5))
    expect(cleanGallery(many)).toEqual(many.slice(0, 6))
    expect(projectImages({ image: blob('cover'), gallery: many })).toHaveLength(6)
    expect(projectImages({ image: blob('cover'), gallery: many })[0]).toBe(blob('cover'))
  })

  it('drops invalid entries, duplicates and the cover itself, without breaking the order', () => {
    const cover = blob('cover')
    expect(cleanGallery([blob(1), 'https://evil.example/x.jpg', blob(1), cover, blob(2), '', 7, null], cover)).toEqual([blob(1), blob(2)])
  })

  it('does not break on a value that is not a list', () => {
    expect(cleanGallery(undefined)).toEqual([])
    expect(cleanGallery(null)).toEqual([])
    expect(cleanGallery('x')).toEqual([])
    expect(cleanGallery({ 0: blob(1) })).toEqual([])
  })
})

describe('a project without a gallery is untouched', () => {
  it('shows its cover alone, or nothing', () => {
    expect(projectImages({ image: blob('cover') })).toEqual([blob('cover')])
    expect(projectImages({ image: '' })).toEqual([])
    expect(projectImages({})).toEqual([])
    expect(projectImages({ image: undefined, gallery: [] })).toEqual([])
  })

  it('keeps an old cover as it is, even one that is not a Blob URL (only the gallery is checked)', () => {
    expect(projectImages({ image: '/images/old-cover.png' })).toEqual(['/images/old-cover.png'])
  })

  it('shows the gallery alone when there is no cover', () => {
    expect(projectImages({ gallery: [blob(1), blob(2)] })).toEqual([blob(1), blob(2)])
  })
})

describe('reordering', () => {
  it('moves a picture to another place, keeping the others in order', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 1, 0)).toEqual(['b', 'a', 'c', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 1, 2)).toEqual(['a', 'c', 'b', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('returns a copy, unchanged, for a move that leads nowhere', () => {
    const list = ['a', 'b']
    for (const [from, to] of [[0, -1], [1, 2], [-1, 0], [5, 0], [1, 1]] as const) {
      const out = moveItem(list, from, to)
      expect(out).toEqual(list)
      expect(out).not.toBe(list)
    }
  })

  it('never changes the list it was given', () => {
    const list = ['a', 'b', 'c']
    moveItem(list, 0, 2)
    expect(list).toEqual(['a', 'b', 'c'])
  })
})

describe('what publishing keeps', () => {
  it('normalises each gallery and leaves everything else of the project as it was', () => {
    const projects = [
      { slug: 'a', title: 'A', image: blob('cover'), gallery: [blob(1), 'https://evil.example/x.jpg', blob(1), blob(2)] },
      { slug: 'b', title: 'B', image: '', gallery: ['https://evil.example/x.jpg'] },
      { slug: 'c', title: 'C', image: blob('c') },
    ]
    const out = sanitizeProjectGalleries(projects)
    expect(out[0]).toEqual({ slug: 'a', title: 'A', image: blob('cover'), gallery: [blob(1), blob(2)] })
    expect(out[1]).toEqual({ slug: 'b', title: 'B', image: '' })
    expect('gallery' in out[1]).toBe(false)
    expect(out[2]).toBe(projects[2])
  })

  it('is wired into the publish action', () => {
    const source = readFileSync(join(__dirname, '..', 'src', 'actions', 'portfolio.ts'), 'utf8')
    expect(source).toContain("import { sanitizeProjectGalleries } from '@/lib/project-gallery'")
    expect(source).toMatch(/sanitizeProjectGalleries\(data\.projects\)/)
    // the admin check stays the first thing the action does
    expect(source).toMatch(/publishPortfolio\(data: PortfolioData\): Promise<void> \{\s*await requireAdmin\(\)/)
  })
})
