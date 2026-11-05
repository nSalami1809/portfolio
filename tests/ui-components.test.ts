import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import CountUp, { parseCountable } from '@/components/ui/CountUp'
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
