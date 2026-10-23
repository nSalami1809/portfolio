import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Project } from '@/types'

vi.mock('next/dynamic', () => ({ default: () => () => null }))

import ProjectGallery from '@/components/projects/ProjectGallery'
import ProjectMedia from '@/components/projects/ProjectMedia'
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
    // the main picture and three thumbnails
    expect(imgs).toHaveLength(4)
    const main = imgs.find((i) => i.includes('alt="Projet démo — Image 1 sur 3"'))!
    const thumbs = imgs.filter((i) => i.includes('sizes="96px"'))
    // priority: preloaded in the head, never lazy
    expect(out).toMatch(/<link rel="preload" as="image"[^>]*projects%2F1-shot\.jpg/)
    expect(main).not.toMatch(/loading="lazy"/)
    expect(thumbs).toHaveLength(3)
    for (const thumb of thumbs) expect(thumb).toMatch(/loading="lazy"/)
  })

  it('fills each thumbnail edge to edge, from the top of the picture', () => {
    const thumbs = [...out.matchAll(/<img[^>]*sizes="96px"[^>]*>/g)].map((m) => m[0])
    expect(thumbs).toHaveLength(3)
    for (const thumb of thumbs) expect(thumb).toMatch(/object-fit:cover;object-position:top center/)
  })

  it('shows the main picture filling its frame from the top: no empty bands at the sides', () => {
    const main = [...out.matchAll(/<img[^>]*alt="Projet démo — Image 1 sur 3"[^>]*>/g)].map((m) => m[0])[0]
    expect(main).toMatch(/object-fit:cover;object-position:top center/)
  })

  it('is written in the visitor\'s language', () => {
    const english = html(h(ProjectGallery, { images, title: 'Demo', labels: en.projects.gallery, fallback: null }))
    expect(english).toContain('Previous image')
    expect(english).toContain('Show image 2')
  })
})

describe('the desktop and mobile views', () => {
  const labels = t.projects.gallery
  const media = (desktop: string[], mobile: string[]) => html(h(ProjectMedia, { desktop, mobile, title: 'Projet démo', labels, fallback: h('p', null, 'vide') }))
  const phones = [blob(11), blob(12), blob(13)]

  it('says what the tabs are for, shows two tabs with an icon each, desktop first and selected, and no counts', () => {
    const out = media([blob(1), blob(2)], phones)
    expect(out).toContain('Voir l’application sur')
    expect(out).toContain('role="tablist"')
    expect(out).toContain('aria-labelledby="project-view-caption"')
    expect(out).toMatch(/id="project-view-tab-desktop"[^>]*aria-selected="true"/)
    expect(out).toMatch(/id="project-view-tab-mobile"[^>]*aria-selected="false"/)
    expect(out).toContain('Ordinateur')
    expect(out).toContain('Mobile')
    // one icon in each tab
    const tabs = [...out.matchAll(/<button[^>]*role="tab"[^>]*>(.*?)<\/button>/g)].map((m) => m[1])
    expect(tabs).toHaveLength(2)
    for (const tab of tabs) expect(tab).toContain('<svg')
    // no numbers in parentheses
    expect(out).not.toMatch(/\(\d+\)/)
    expect(out).toContain('role="tabpanel"')
    expect(out).toContain('aria-labelledby="project-view-tab-desktop"')
  })

  it('loads only the view on show: the phone pictures are not on the page until the tab is chosen', () => {
    const out = media([blob(1), blob(2)], phones)
    expect(out).toContain('data-view="desktop"')
    expect(out).not.toContain('data-view="mobile"')
    expect(out).not.toContain('11-shot.jpg')
  })

  it('has no tabs when there is only one view', () => {
    const desktopOnly = media([blob(1), blob(2)], [])
    expect(desktopOnly).not.toContain('tablist')
    expect(desktopOnly).toContain('data-view="desktop"')
    const mobileOnly = media([], phones)
    expect(mobileOnly).not.toContain('tablist')
    expect(mobileOnly).toContain('data-view="mobile"')
    expect(mobileOnly.match(/data-testid="gallery-thumb"/g)).toHaveLength(3)
  })

  it('draws the phone view in an iPhone: Dynamic Island, side buttons, 393 × 852 screen', () => {
    const phone = media([], phones)
    expect(phone).toContain('data-testid="gallery-phone"')
    expect(phone).toContain('data-testid="gallery-island"')
    expect(phone).toContain('aspect-ratio:393/852')
    expect(phone).toContain('aspect-ratio:126/37')
    expect(phone).not.toContain('gallery-window')
    // the island and the home indicator never catch a click
    expect(phone.match(/pointer-events:none/g)!.length).toBeGreaterThanOrEqual(3)
  })

  it('draws the desktop view in a browser window: traffic lights, address bar with the site\'s address', () => {
    const out = html(h(ProjectMedia, { desktop: [blob(1), blob(2)], mobile: [], title: 'Projet démo', labels, fallback: null, address: 'new-erahub.vercel.app' }))
    expect(out).toContain('data-testid="gallery-window"')
    for (const colour of ['#ff5f57', '#febc2e', '#28c840']) expect(out).toContain(colour)
    expect(out).toContain('new-erahub.vercel.app')
    expect(out).toContain('aspect-ratio:7/4')
    expect(out).not.toContain('gallery-phone')
  })

  it('falls back on the project\'s title when it has no live address', () => {
    expect(media([blob(1), blob(2)], [])).toMatch(/<span[^>]*>Projet démo<\/span>/)
  })

  it('is written in English too', () => {
    const out = html(h(ProjectMedia, { desktop: [blob(1)], mobile: phones, title: 'Demo', labels: en.projects.gallery, fallback: null }))
    expect(out).toContain('Desktop')
    expect(out).toContain('Mobile')
    expect(out).toContain('View the app on')
  })

  const base = { slug: 'd', title: 'D', description: 'c', longDescription: 'l', category: 'Web', tags: ['x'], year: '2026', status: 'completed' as const }
  it('on the project page: a single cover plus phone screenshots shows both views; without any phone picture nothing changes', () => {
    const withPhones = view({ ...base, image: blob(1), galleryMobile: phones })
    expect(withPhones).toContain('data-testid="project-media"')
    expect(withPhones).toContain('Mobile')
    const without = view({ ...base, image: blob(1) })
    expect(without).not.toContain('project-media')
    expect(without).not.toContain('tablist')
    const onlyPhones = view({ ...base, image: '', galleryMobile: phones })
    expect(onlyPhones).toContain('data-view="mobile"')
    expect(onlyPhones).not.toContain('tablist')
  })

  it('the mobile pictures of an invalid host never reach the page', () => {
    const out = view({ ...base, image: blob(1), galleryMobile: ['https://evil.example/x.jpg'] })
    expect(out).not.toContain('evil.example')
    expect(out).not.toContain('project-media')
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

  it('keeps the cover field and adds a desktop and a mobile panel below it, under one explained section', () => {
    expect(admin).toContain('<ImageUpload label="Image de couverture"')
    expect(admin.match(/<GalleryEditor/g)).toHaveLength(2)
    expect(admin).toContain('label="Version ordinateur"')
    expect(admin).toContain('label="Version mobile"')
    expect(admin).toContain('device="desktop"')
    expect(admin).toContain('device="phone"')
    expect(admin).toContain('data-testid="project-images-section"')
    expect(admin.indexOf('<ImageUpload label="Image de couverture"')).toBeLessThan(admin.indexOf('<GalleryEditor'))
    expect(admin.indexOf('label="Version ordinateur"')).toBeLessThan(admin.indexOf('label="Version mobile"'))
  })

  it('shows the cover as the first, read-only image of the desktop panel', () => {
    expect(admin).toMatch(/leading=\{form\.image \|\| undefined\}/)
    expect(editor).toContain("data-testid={`${id}-cover`}")
    expect(editor).toContain('Modifiable plus haut')
  })

  it('takes files by dropping them on the panel as well as by clicking, and says so', () => {
    expect(editor).toContain('onDrop={onDrop}')
    expect(editor).toContain('Glissez vos captures ici ou cliquez pour parcourir')
    expect(editor).toContain('e.dataTransfer.files')
    // dropping is refused once the panel is full
    expect(editor).toMatch(/if \(room > 0\) void addFiles/)
  })

  it('numbers the pictures in the order the visitor sees them', () => {
    expect(editor).toMatch(/String\(i \+ 1 \+ \(leading \? 1 : 0\)\)/)
  })

  it('saves the mobile gallery cleaned too', () => {
    expect(admin).toMatch(/cleanGallery\(form\.galleryMobile\)/)
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
