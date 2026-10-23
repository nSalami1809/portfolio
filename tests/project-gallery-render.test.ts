import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Project } from '@/types'

vi.mock('next/dynamic', () => ({ default: () => () => null }))

import ProjectGallery from '@/components/projects/ProjectGallery'
import ProjectDetailView from '@/app/[locale]/projects/[slug]/ProjectDetailView'
import { getDictionary } from '@/lib/i18n/dictionaries'

const blob = (n: number) => `https://abc123.public.blob.vercel-storage.com/projects/${n}-shot.jpg`
const t = getDictionary('fr')
const en = getDictionary('en')
const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el)

const project = (over: Partial<Project> = {}): Project => ({
  slug: 'demo', title: 'Projet démo', description: 'Court.', longDescription: 'Long.', category: 'Web', tags: ['React'], year: '2026', status: 'completed', ...over,
})
const view = (p: Project) => html(h(ProjectDetailView, { project: p, locale: 'fr', t: t.projects, statusLabel: t.status }))

describe('the gallery on the project page', () => {
  const images = [blob(1), blob(2), blob(3)]
  const out = html(h(ProjectGallery, { images, title: 'Projet démo', labels: t.projects.gallery, fallback: h('p', null, 'vide') }))

  it('shows one main picture, one thumbnail per picture, arrows and a counter', () => {
    expect(out).toContain('data-testid="project-gallery"')
    expect(out.match(/data-testid="gallery-main"/g)).toHaveLength(1)
    expect(out.match(/data-testid="gallery-thumb"/g)).toHaveLength(3)
    expect(out).toContain('data-testid="gallery-prev"')
    expect(out).toContain('data-testid="gallery-next"')
    expect(out).toContain('1 / 3')
  })

  it('marks the selected thumbnail for assistive technology and gives every control a name', () => {
    expect(out.match(/aria-current="true"/g)).toHaveLength(1)
    for (const label of ['Image précédente', 'Image suivante', 'Afficher l’image 2', 'Agrandir l’image — Image 1 sur 3']) expect(out, label).toContain(label)
    expect(out).toContain('aria-roledescription="carousel"')
  })

  it('loads the main picture first and every thumbnail lazily', () => {
    const imgs = [...out.matchAll(/<img[^>]*>/g)].map((m) => m[0])
    expect(imgs).toHaveLength(4)
    // priority: preloaded in the head, never lazy
    expect(out).toMatch(/<link rel="preload" as="image"[^>]*projects%2F1-shot\.jpg/)
    expect(imgs[0]).not.toMatch(/loading="lazy"/)
    for (const thumb of imgs.slice(1)) expect(thumb).toMatch(/loading="lazy"/)
    // thumbnails are asked at their own size, not at the page's
    for (const thumb of imgs.slice(1)) expect(thumb).toMatch(/sizes="96px"/)
  })

  it('is written in the visitor\'s language', () => {
    const english = html(h(ProjectGallery, { images, title: 'Demo', labels: en.projects.gallery, fallback: null }))
    expect(english).toContain('Previous image')
    expect(english).toContain('Show image 2')
  })
})

describe('the project page, with and without a gallery', () => {
  it('is unchanged without a gallery: the cover alone, no gallery controls', () => {
    const page = view(project({ image: blob(1) }))
    expect(page).not.toContain('project-gallery')
    expect(page).not.toContain('gallery-thumb')
    expect(page).toContain('projects%2F1-shot.jpg')
  })

  it('keeps the placeholder for a project without any picture', () => {
    const page = view(project({ image: '' }))
    expect(page).not.toContain('project-gallery')
    expect(page).toContain(t.projects.previewUnavailable)
  })

  it('shows the gallery as soon as there is more than one picture', () => {
    const page = view(project({ image: blob(1), gallery: [blob(2), blob(3)] }))
    expect(page).toContain('data-testid="project-gallery"')
    expect(page.match(/data-testid="gallery-thumb"/g)).toHaveLength(3)
  })

  it('ignores invalid gallery entries instead of breaking: a lone valid picture shows as the plain page', () => {
    const page = view(project({ image: blob(1), gallery: ['https://evil.example/x.jpg', 'javascript:alert(1)'] }))
    expect(page).not.toContain('project-gallery')
    expect(page).not.toContain('evil.example')
    expect(page).toContain('projects%2F1-shot.jpg')
  })

  it('shows a gallery picture alone when the project has no cover', () => {
    const page = view(project({ image: '', gallery: [blob(2)] }))
    expect(page).not.toContain('project-gallery')
    expect(page).toContain('projects%2F2-shot.jpg')
  })

  it('stops at six pictures, cover included', () => {
    const page = view(project({ image: blob(0), gallery: Array.from({ length: 9 }, (_, i) => blob(i + 1)) }))
    expect(page.match(/data-testid="gallery-thumb"/g)).toHaveLength(6)
  })
})

describe('the page keeps its width on a phone and only valid pictures reach it', () => {
  const read = (...p: string[]) => readFileSync(join(__dirname, '..', 'src', ...p), 'utf8')

  it('lets the row of thumbnails scroll inside the page instead of widening it', () => {
    expect(read('components', 'projects', 'ProjectGallery.tsx')).toMatch(/width: 0, minWidth: '100%'/)
    expect(read('app', '[locale]', 'projects', '[slug]', 'ProjectDetailView.tsx')).toMatch(/\{\/\* Main \*\/\}\s*<div className="min-w-0">/)
  })

  it('cleans the gallery on the server before the page and its payload are built', () => {
    const page = read('app', '[locale]', 'projects', '[slug]', 'page.tsx')
    expect(page).toContain("import { sanitizeProjectGalleries } from '@/lib/project-gallery'")
    expect(page).toMatch(/sanitizeProjectGalleries\(\[project\]\)\[0\]/)
  })
})

describe('the enlarged view', () => {
  const root = join(__dirname, '..', 'src', 'components', 'projects')
  const lightbox = readFileSync(join(root, 'ProjectLightbox.tsx'), 'utf8')
  const gallery = readFileSync(join(root, 'ProjectGallery.tsx'), 'utf8')

  it('is fetched only when a visitor opens it', () => {
    expect(gallery).toMatch(/dynamic\(\(\) => import\('\.\/ProjectLightbox'\), \{ ssr: false \}\)/)
    expect(gallery).not.toMatch(/^import .*ProjectLightbox/m)
    expect(gallery).toMatch(/\{open && <ProjectLightbox/)
  })

  it('closes with the button, Escape and a click outside the controls, and gives focus back', () => {
    expect(lightbox).toContain("e.key === 'Escape'")
    expect(lightbox).toMatch(/onClick=\{onClose\}/)
    expect(lightbox).toMatch(/data-testid="gallery-close"/)
    expect(lightbox).toContain('aria-modal="true"')
    expect(gallery).toMatch(/opener\.current\?\.focus\(\)/)
  })

  it('locks the page scroll while open and restores it', () => {
    expect(lightbox).toContain("document.body.style.overflow = 'hidden'")
    expect(lightbox).toContain('document.body.style.overflow = previousOverflow')
  })

  it('does not bring a carousel library', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))
    const deps = Object.keys({ ...pkg.dependencies })
    expect(deps.filter((d) => /swiper|embla|slick|carousel|lightbox|photoswipe/i.test(d))).toEqual([])
  })
})

describe('the editor in the back-office', () => {
  const admin = readFileSync(join(__dirname, '..', 'src', 'app', 'admin', 'projects', 'page.tsx'), 'utf8')
  const editor = readFileSync(join(__dirname, '..', 'src', 'components', 'admin', 'GalleryEditor.tsx'), 'utf8')

  it('keeps the cover field and adds the gallery below it', () => {
    expect(admin).toContain('<ImageUpload label="Image du projet"')
    expect(admin).toContain('<GalleryEditor')
    expect(admin.indexOf('<ImageUpload label="Image du projet"')).toBeLessThan(admin.indexOf('<GalleryEditor'))
  })

  it('goes through the same upload as the cover and never deletes a Blob eagerly', () => {
    expect(editor).toContain("import { compressImage, uploadFile } from '@/lib/upload'")
    expect(editor).not.toContain('deleteUploadedFile')
  })

  it('cleans the gallery when the project is saved and when the cover changes', () => {
    expect(admin).toMatch(/cleanGallery\(form\.gallery, form\.image \|\| undefined\)/)
    expect(admin).toMatch(/gallery: cleanGallery\(p\.gallery, v \|\| undefined\)/)
  })
})
