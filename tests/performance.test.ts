import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sceneAllowed } from '@/components/scene/ParticleWaveClient'

const read = (...p: string[]) => readFileSync(join(__dirname, '..', 'src', ...p), 'utf8')

const win = (width: number, saveData = false) => ({
  matchMedia: (q: string) => ({ matches: q === '(min-width: 768px)' ? width >= 768 : false }),
  navigator: { connection: { saveData } },
}) as unknown as Pick<Window, 'matchMedia' | 'navigator'>

describe('the blog\'s 3D background (three.js, the heaviest code of the public site)', () => {
  it('is wanted on a desktop or tablet screen only', () => {
    expect(sceneAllowed(win(1280))).toBe(true)
    expect(sceneAllowed(win(768))).toBe(true)
    expect(sceneAllowed(win(390))).toBe(false)
  })

  it('is not wanted when the visitor asked the browser to save data', () => {
    expect(sceneAllowed(win(1280, true))).toBe(false)
  })

  it('does not exist before the page is idle: nothing is mounted until an effect has decided', () => {
    const src = read('components', 'scene', 'ParticleWaveClient.tsx')
    expect(src).toMatch(/useState\(false\)/)
    expect(src).toMatch(/requestIdleCallback/)
    expect(src).toMatch(/return ready \? <ParticleWave \/> : null/)
  })

  it('draws nothing while the tab is hidden', () => {
    expect(read('components', 'scene', 'ParticleWave.tsx')).toMatch(/if \(!document\.hidden\) invalidate\(\)/)
  })
})

describe('content that is in the server HTML is never hidden until JavaScript runs', () => {
  // Without initial={false}, framer-motion writes opacity:0 into the server HTML of every child that has an `initial`
  // opacity, and the content stays invisible until the whole JavaScript has loaded (seconds on a phone).
  for (const [name, file] of [
    ['projects list', ['app', '[locale]', 'projects', 'ProjectsView.tsx']],
    ['documents list', ['app', '[locale]', 'documents', 'DocumentsView.tsx']],
    ['offers carousel', ['app', '[locale]', 'offres', 'OffersView.tsx']],
  ] as const) {
    it(`${name}: its AnimatePresence does not animate the first render`, () => {
      const src = read(...file)
      const tags = src.match(/<AnimatePresence[^>]*>/g) ?? []
      expect(tags.length).toBeGreaterThan(0)
      for (const tag of tags) expect(tag).toContain('initial={false}')
    })
  }

  it('the first cards of the lists load at once and the very first with top priority', () => {
    for (const file of [['app', '[locale]', 'projects', 'ProjectsView.tsx'], ['app', '[locale]', 'documents', 'DocumentsView.tsx']]) {
      const src = read(...file)
      expect(src).toMatch(/loading=\{i < 2 \? 'eager' : 'lazy'\}/)
      expect(src).toMatch(/fetchPriority=\{i === 0 \? 'high' : undefined\}/)
    }
  })
})

describe('the light/dark switch', () => {
  it('freezes CSS transitions for the instant of the switch and gives them back', () => {
    const hook = read('hooks', 'useTheme.ts')
    expect(hook).toContain("classList.add('theme-switching')")
    expect(hook).toMatch(/requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => root\.classList\.remove\('theme-switching'\)\)\)/)
    const css = read('app', 'globals.css')
    expect(css).toMatch(/html\.theme-switching \*,[\s\S]*?transition: none !important/)
  })
})
