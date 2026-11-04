import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import CountUp, { parseCountable } from '@/components/ui/CountUp'
import TechMarquee from '@/components/sections/TechMarquee'
import ReadingProgress from '@/components/ui/ReadingProgress'

const read = (...p: string[]) => readFileSync(join(__dirname, '..', 'src', ...p), 'utf8')

describe('CountUp', () => {
  it('reads the figures of the home page and nothing else', () => {
    expect(parseCountable('3+')).toEqual({ prefix: '', n: 3, suffix: '+' })
    expect(parseCountable('10+')).toEqual({ prefix: '', n: 10, suffix: '+' })
    expect(parseCountable('100%')).toEqual({ prefix: '', n: 100, suffix: '%' })
    expect(parseCountable('24/7')).toBeNull() // two numbers: a label, not a count
    expect(parseCountable('Bac+5')).toBeNull()
    expect(parseCountable('Sur mesure')).toBeNull()
    expect(parseCountable('')).toBeNull()
  })

  it('puts the FINAL value in the server HTML, with the same value for screen readers', () => {
    const html = renderToStaticMarkup(h(CountUp, { value: '15+' }))
    expect(html).toContain('>15+</span>')
    expect(html).toContain('class="sr-only">15+</span>')
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toMatch(/opacity:\s*0/)
  })

  it('is used for the four figures of the home page', () => {
    expect(read('app', '[locale]', 'page.tsx')).toMatch(/<CountUp value=\{value\} \/>/)
  })
})

describe('TechMarquee', () => {
  const logo = 'https://x.public.blob.vercel-storage.com/images/react.png'
  const html = renderToStaticMarkup(h(TechMarquee, {
    items: [{ name: 'React', icon: logo }, { name: 'Next.js' }, { name: 'Docker' }, { name: 'MongoDB' }, { name: 'React', icon: logo }, { name: ' Node.js ' }],
    label: 'Technologies',
  }))

  it('lists each technology once per copy, without duplicates', () => {
    const copies = html.split('<ul').length - 1
    expect(copies).toBe(2)
    expect((html.match(/>React</g) ?? []).length).toBe(2) // one per copy, not four
    expect(html).toContain('Node.js')
  })

  it('hides the second copy from assistive technology and names the ribbon', () => {
    const groups = html.split('<ul').slice(1)
    const opening = (g: string) => /^[^>]*>/.exec(g)?.[0] ?? ''
    expect(opening(groups[0])).not.toContain('aria-hidden')
    expect(opening(groups[1])).toContain('aria-hidden="true"')
    expect(html).toContain('aria-label="Technologies"')
  })

  it('shows nothing when there are too few technologies to make a ribbon', () => {
    expect(renderToStaticMarkup(h(TechMarquee, { items: [{ name: 'React' }, { name: 'Docker' }], label: 'x' }))).toBe('')
  })

  it('shows the logo of each technology in a square tile (no dot) and only where a logo exists', () => {
    expect((html.match(/tech-marquee-logo/g) ?? []).length).toBe(2) // React, once per copy; the others have no logo
    expect(html).not.toContain('tech-marquee-dot')
    expect(html).toMatch(/<img[^>]*alt=""[^>]*width="20"[^>]*height="20"/) // same size as the stack cards: one download
    const css = read('app', 'globals.css')
    expect(css).toMatch(/\.tech-marquee-logo \{[\s\S]*?width: 28px;[\s\S]*?height: 28px;[\s\S]*?background: rgba\(255, 255, 255, 0\.92\);/)
    expect(css).not.toMatch(/\.tech-marquee-logo \{[^}]*border-radius/)
  })

  it('gets the logos saved with the skills on the home page', () => {
    expect(read('app', '[locale]', 'page.tsx')).toMatch(/s\.items\.map\(\(name\) => \(\{ name, icon: s\.icons\?\.\[name\] \}\)\)/)
  })

  it('is pure CSS: it animates a transform, pauses on hover and stands still for reduced motion', () => {
    const css = read('app', 'globals.css')
    expect(css).toMatch(/@keyframes tech-marquee \{\s*to \{ transform: translateX\(-50%\); \}/)
    expect(css).toMatch(/\.tech-marquee:hover \.tech-marquee-track \{ animation-play-state: paused; \}/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{[\s\S]*?\.tech-marquee-track \{ animation: none;/)
    expect(read('components', 'sections', 'TechMarquee.tsx')).not.toMatch(/'use client'/)
  })

  it('sits between the hero and the about section of the home page', () => {
    const page = read('app', '[locale]', 'page.tsx')
    expect(page.indexOf('<HeroSection')).toBeLessThan(page.indexOf('<TechMarquee'))
    expect(page.indexOf('<TechMarquee')).toBeLessThan(page.indexOf('id="apropos"'))
  })
})

describe('no mouse spotlight on the cards (removed on purpose)', () => {
  it('leaves no trace in the markup, the styles or the layout', () => {
    expect(read('app', 'globals.css')).not.toContain('data-spotlight')
    expect(read('app', '[locale]', 'layout.tsx')).not.toContain('Spotlight')
    for (const file of [
      ['app', '[locale]', 'projects', 'ProjectsView.tsx'], ['app', '[locale]', 'documents', 'DocumentsView.tsx'],
      ['app', '[locale]', 'guides', 'page.tsx'], ['components', 'projects', 'MoreProjects.tsx'],
      ['app', '[locale]', 'offres', 'OffersView.tsx'], ['components', 'sections', 'WorkProcess.tsx'], ['app', '[locale]', 'page.tsx'],
    ]) expect(read(...file), file.join('/')).not.toContain('data-spotlight')
  })
})

describe('reading progress', () => {
  it('renders an empty decorative bar', () => {
    expect(renderToStaticMarkup(h(ReadingProgress))).toBe('<div class="reading-progress" aria-hidden="true"></div>')
  })

  it('is driven by the page scroll in CSS only, and hidden where the browser cannot do that', () => {
    const css = read('app', 'globals.css')
    expect(css).toMatch(/\.reading-progress \{ display: none; \}/)
    expect(css).toMatch(/@supports \(animation-timeline: scroll\(\)\) \{[\s\S]*?animation-timeline: scroll\(root block\)/)
    expect(read('components', 'ui', 'ReadingProgress.tsx')).not.toMatch(/'use client'|addEventListener/)
  })

  it('is on the practical guides and on the blog articles', () => {
    expect(read('app', '[locale]', 'guides', '[slug]', 'page.tsx')).toContain('<ReadingProgress />')
    expect(read('app', '[locale]', 'blog', '[slug]', 'BlogPostView.tsx')).toContain('<ReadingProgress />')
  })
})
