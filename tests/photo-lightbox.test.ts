import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import PhotoLightbox from '@/components/ui/PhotoLightbox'
import { getDictionary } from '@/lib/i18n/dictionaries'

const root = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')
const SRC = 'https://x.public.blob.vercel-storage.com/images/me.webp'

describe('the profile picture, as the server sends it', () => {
  const html = renderToStaticMarkup(h(PhotoLightbox, { src: SRC, alt: 'Nawaf', openLabel: 'Agrandir', closeLabel: 'Fermer' }))

  it('is a button that announces a dialog, with an accessible name', () => {
    expect(html).toContain('<button')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-label="Agrandir"')
  })

  it('keeps the round small picture without any ring around it, and nothing of the big view is in the page yet', () => {
    expect(html).toContain('rounded-full')
    expect(html).not.toContain('border:')
    expect(html).not.toContain('box-shadow')
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain('Fermer')
  })
})

describe('the big view', () => {
  const src = read('src', 'components', 'ui', 'PhotoLightbox.tsx')

  it('is a modal dialog in a portal (the hero has a transform and overflow that would trap it)', () => {
    expect(src).toContain('createPortal(')
    expect(src).toContain('role="dialog"')
    expect(src).toContain('aria-modal="true"')
  })

  it('grows out of the small picture and shrinks back into it (same place, same size)', () => {
    expect(src).toContain('function flip(')
    expect(src).toContain('trigger.getBoundingClientRect()')
    expect(src).toMatch(/photo\.style\.transform = flip\(/)
  })

  it('closes with a tap anywhere, the cross, or Escape, and gives the focus back', () => {
    expect(src).toContain('onClick={close}')
    expect(src).toContain("e.key === 'Escape'")
    expect(src).toContain('restoreFocus.current = true')
    expect(src).toContain('triggerRef.current?.focus({ preventScroll: true })')
  })

  it('freezes the page behind it and lets it go again', () => {
    expect(src).toContain("html.style.overflow = 'hidden'")
    expect(src).toContain('html.style.overflow = previous')
  })

  it('has no animation for people who asked for less motion', () => {
    expect(src).toContain('prefers-reduced-motion: reduce')
  })

  it('downloads the big picture only when the reader shows interest, never on page load', () => {
    expect(src).toContain('onPointerEnter={warm}')
    expect(src).toContain('onTouchStart={warm}')
    expect(src).toContain('getImageProps')
  })
})

describe('texts and placement', () => {
  it('exist in French and in English', () => {
    expect(getDictionary('fr').home.heroPhotoOpen).toBeTruthy()
    expect(getDictionary('fr').home.heroPhotoClose).toBeTruthy()
    expect(getDictionary('en').home.heroPhotoOpen).toBe('Enlarge the profile photo')
    expect(getDictionary('en').home.heroPhotoClose).toBe('Close the photo')
  })

  it('the home page hero uses it', () => {
    const hero = read('src', 'components', 'sections', 'HeroSection.tsx')
    expect(hero).toContain('<PhotoLightbox')
    expect(hero).toContain('openLabel={t.heroPhotoOpen}')
  })
})
