import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDictionary } from '@/lib/i18n/dictionaries'

const root = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')
const css = read('src', 'app', 'globals.css').replace(/\r\n/g, '\n')

const lum = (hex: string) => {
  const c = hex.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1], m[2]]))
const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('\n.dark {')))
const dark = tokens(css.slice(css.indexOf('\n.dark {'), css.indexOf('\n.dark {') + 2500))

describe('text contrast (WCAG AA, 4.5:1) on every background of the site', () => {
  for (const [name, t] of [['light', light], ['dark', dark]] as const) {
    for (const fg of ['text', 'text-muted', 'text-subtle', 'brand']) {
      for (const bg of ['bg', 'bg-secondary', 'surface', 'surface-hover']) {
        it(`${name}: ${fg} on ${bg}`, () => {
          expect(t[fg], `${fg} token`).toBeTruthy()
          expect(t[bg], `${bg} token`).toBeTruthy()
          expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
  }
})

describe('moving content', () => {
  const marquee = read('src', 'components', 'sections', 'TestimonialsMarquee.tsx')

  it('can be paused with one button, in both languages', () => {
    expect(marquee).toContain('aria-pressed={paused}')
    expect(marquee).toContain("animationPlayState: paused ? 'paused' : undefined")
    expect(marquee).toContain('pausedRef.current')
    for (const l of ['fr', 'en'] as const) {
      expect(getDictionary(l).home.testimonialsPause).toBeTruthy()
      expect(getDictionary(l).home.testimonialsPlay).toBeTruthy()
    }
  })

  it('turns into a still grid for people who ask for less motion', () => {
    expect(marquee).toMatch(/if \(reducedMotion\) \{[\s\S]*?grid sm:grid-cols-2 lg:grid-cols-3/)
  })

  it('shows each testimonial once to a screen reader and to the keyboard (the repeated copies are hidden and inert)', () => {
    expect(marquee).toContain('aria-hidden={duplicate || undefined}')
    expect(marquee).toContain('inert={duplicate || undefined}')
    expect(marquee.match(/duplicate=\{hydrated && i >= items\.length\}/g)?.length).toBe(2)
  })

  it('the counters stay still for reduced motion and keep their final value in the HTML', () => {
    const count = read('src', 'components', 'ui', 'CountUp.tsx')
    expect(count).toContain('prefers-reduced-motion: reduce')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})

describe('head and keyboard', () => {
  it('has no meta keywords tag (search engines ignore it)', () => {
    expect(read('src', 'app', 'layout.tsx')).not.toMatch(/^\s*keywords:/m)
    expect(read('src', 'app', '[locale]', 'layout.tsx')).not.toMatch(/^\s*keywords:/m)
  })

  it('keeps a skip link to the main content, visible when focused, and a visible focus ring everywhere', () => {
    const layout = read('src', 'app', '[locale]', 'layout.tsx')
    expect(layout).toContain('href="#main-content"')
    expect(layout).toContain('focus:not-sr-only')
    expect(layout).toContain('<main id="main-content"')
    expect(css).toMatch(/:focus-visible \{\s*outline: 2px solid var\(--brand\);/)
  })
})
