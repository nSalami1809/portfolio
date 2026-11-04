import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ProjectFolders from '@/components/projects/ProjectFolders'
import { countLabel, fanPose, groupFolders, MAX_COVERS, MIN_FOLDERS } from '@/lib/project-folders'
import { getDictionary } from '@/lib/i18n/dictionaries'

const read = (...p: string[]) => readFileSync(join(__dirname, '..', 'src', ...p), 'utf8')
const img = (n: number) => `https://x.public.blob.vercel-storage.com/images/${n}.png`
const P = (slug: string, category: string, image?: string) => ({ slug, title: slug.toUpperCase(), category, image })

describe('groupFolders', () => {
  const projects = [P('a', 'Web', img(1)), P('b', 'DevOps'), P('c', 'Web'), P('d', 'Web', img(4)), P('e', 'Web', img(5)), P('f', ' DevOps ', img(6)), P('g', '')]

  it('makes one folder per category, in the order they first appear, and ignores projects without a category', () => {
    const f = groupFolders(projects)
    expect(f.map((x) => x.category)).toEqual(['Web', 'DevOps'])
    expect(f.map((x) => x.count)).toEqual([4, 2]) // "DevOps" and " DevOps " are the same category
  })

  it(`pictures at most ${MAX_COVERS} projects per folder, those with a picture first`, () => {
    const web = groupFolders(projects)[0]
    expect(web.covers).toHaveLength(MAX_COVERS)
    expect(web.covers.map((c) => c.slug)).toEqual(['a', 'd', 'e'])
    expect(web.count).toBe(4) // the count is the whole category, not the fan
    const devops = groupFolders(projects)[1]
    expect(devops.covers.map((c) => c.slug)).toEqual(['f', 'b'])
    expect(devops.covers[1].image).toBeUndefined()
  })

  it('handles an empty list', () => {
    expect(groupFolders([])).toEqual([])
  })
})

describe('the fan', () => {
  it('spreads 1, 2 or 3 cards symmetrically around the middle', () => {
    expect(fanPose(0, 1)).toEqual({ x: 0, y: -60, r: 0 })
    expect(fanPose(0, 2).x).toBe(-fanPose(1, 2).x)
    expect(fanPose(0, 2).r).toBe(-fanPose(1, 2).r)
    expect(fanPose(0, 3).x).toBe(-fanPose(2, 3).x)
    expect(fanPose(1, 3)).toMatchObject({ x: 0, r: 0 })
    expect(fanPose(1, 3).y).toBeLessThan(fanPose(0, 3).y) // the middle card comes out highest
  })

  it('never throws on an unexpected index or size', () => {
    expect(() => { fanPose(9, 9); fanPose(-1, 0) }).not.toThrow()
  })
})

describe('countLabel', () => {
  it('uses the singular for one and the plural otherwise, in each language', () => {
    expect(countLabel(1, '{n} projet', '{n} projets')).toBe('1 projet')
    expect(countLabel(4, '{n} projet', '{n} projets')).toBe('4 projets')
    expect(countLabel(1, '{n} project', '{n} projects')).toBe('1 project')
  })
})

describe('texts', () => {
  it('exist in French and in English, without functions (they cross to a client component)', () => {
    for (const locale of ['fr', 'en'] as const) {
      const t = getDictionary(locale).projects
      for (const key of ['foldersLabel', 'foldersHint', 'folderOne', 'folderMany', 'folderOpenAria', 'folderSeeAll'] as const) {
        expect(typeof t[key], `${locale}.${key}`).toBe('string')
        expect(t[key].length).toBeGreaterThan(3)
      }
      expect(t.folderOne).toContain('{n}')
      expect(t.folderMany).toContain('{n}')
      expect(t.folderOpenAria).toContain('{name}')
    }
  })
})

describe('ProjectFolders as the server sends it', () => {
  const t = getDictionary('fr').projects
  const projects = [P('a', 'Web', img(1)), P('b', 'Web', img(2)), P('c', 'DevOps', img(3))]
  const render = (list = projects) => renderToStaticMarkup(h(ProjectFolders, { projects: list, locale: 'fr', t, onSeeCategory: () => {} }))
  const html = render()

  it('is on the page from the start: one closed folder per category with its count', () => {
    expect((html.match(/class="folder"/g) ?? []).length).toBe(2)
    expect(html).toContain('2 projets')
    expect(html).toContain('1 projet<')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('data-open')
  })

  it('does not download a single picture before a folder is opened', () => {
    expect(html).not.toContain('<img')
    expect(html).not.toContain('/_next/image')
  })

  it('keeps the cards out of reach (inert) while the folder is closed, and links them to the projects', () => {
    expect(html).toMatch(/class="folder-fan" inert=""/)
    expect(html).toContain('href="/fr/projects/a"')
    expect(html).toContain('href="/fr/projects/c"')
  })

  it('puts the cards after the folder button in the page, so Tab goes from the folder to its cards', () => {
    const first = html.split('class="folder"')[1]
    expect(first.indexOf('class="folder-front"')).toBeGreaterThan(-1)
    expect(first.indexOf('class="folder-front"')).toBeLessThan(first.indexOf('class="folder-fan"'))
    expect(first.indexOf('class="folder-fan"')).toBeLessThan(first.indexOf('class="folder-see"'))
  })

  it('names each folder button for assistive technology', () => {
    expect(html).toContain('aria-label="Ouvrir le dossier Web"')
    expect(html).toContain(`>${t.folderSeeAll}<`)
  })

  it(`shows nothing when there are fewer than ${MIN_FOLDERS} categories`, () => {
    expect(render([P('a', 'Web', img(1)), P('b', 'Web')])).toBe('')
    expect(render([])).toBe('')
  })
})

describe('code and style', () => {
  const component = read('components', 'projects', 'ProjectFolders.tsx')
  const css = read('app', 'globals.css')
  const folderCss = css.slice(css.indexOf('/* ── Project folders'), css.indexOf('/* ── Technology ribbon'))

  it('requests the pictures only after the first opening, right away once wanted', () => {
    expect(component).toMatch(/if \(next\) setPictures\(true\)/)
    expect(component).toMatch(/pictures && p\.image \?/)
    expect(component).toContain('loading="eager"')
  })

  it('opens with a mouse (hover), a tap or the keyboard, and closes with Escape, outside or a mouse leaving', () => {
    expect(component).toMatch(/e\.pointerType === 'mouse'\) show\(true\)/)
    expect(component).toMatch(/onClick=\{\(\) => show\(!open\)\}/)
    expect(component).toContain("e.key === 'Escape'")
    expect(component).toContain("addEventListener('pointerdown'")
    expect(component).toMatch(/aria-expanded=\{open\}/)
  })

  it('keeps the identity of the site: flat, square, one accent, no library', () => {
    expect(folderCss.length).toBeGreaterThan(500)
    expect(folderCss).not.toMatch(/border-radius|box-shadow|backdrop-filter|filter:/)
    expect(folderCss).toContain('var(--brand, var(--accent))')
    expect(component).not.toMatch(/framer-motion|three|lucide/)
  })

  it('moves with transforms and opacity only, and stands still for reduced motion', () => {
    expect(folderCss).toMatch(/transition: transform [\s\S]*?opacity/)
    expect(folderCss).toMatch(/prefers-reduced-motion: reduce\) \{[\s\S]*?\.folder-card,[\s\S]*?transition: none;/)
  })

  it('sits above the search and the list on the projects page, and "See the category" filters the list', () => {
    const view = read('app', '[locale]', 'projects', 'ProjectsView.tsx')
    expect(view.indexOf('<ProjectFolders')).toBeLessThan(view.indexOf('type="search"'))
    expect(view).toContain('onSeeCategory={seeCategory}')
    expect(view).toMatch(/const apply = \(\) => \{ if \(category !== active\) setActive\(category\) \}/)
    expect(view).toContain('id="projects-list"')
  })

  it('scrolls to the list FIRST and filters it on arrival (filtering while scrolling ended back at the top)', () => {
    const view = read('app', '[locale]', 'projects', 'ProjectsView.tsx')
    const scrollAt = view.indexOf("list.scrollIntoView({ behavior: 'smooth', block: 'start' })")
    expect(scrollAt).toBeGreaterThan(-1)
    expect(view).toContain("window.addEventListener('scrollend', arrived, { once: true })")
    expect(view).toMatch(/window\.setTimeout\(arrived, 1200\)/) // browsers without scrollend, or an interrupted scroll
    expect(view).toMatch(/!list \|\| reduce \|\|/) // reduced motion: instant, no animation
    expect(view).not.toMatch(/onExitComplete|pendingScroll/)
  })
})
