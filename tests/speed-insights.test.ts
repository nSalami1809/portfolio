import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import SpeedInsights from '@/components/analytics/SpeedInsights'

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

describe('Speed Insights (real-visitor performance)', () => {
  const original = process.env.VERCEL
  afterEach(() => { if (original === undefined) delete process.env.VERCEL; else process.env.VERCEL = original })

  it('is not loaded outside Vercel (the script is served by the platform: locally it would be a 404)', () => {
    delete process.env.VERCEL
    expect(SpeedInsights()).toBeNull()
  })

  it('is loaded on Vercel', () => {
    process.env.VERCEL = '1'
    expect(SpeedInsights()).not.toBeNull()
  })

  it('never delays the page: scripts wait for idle, same origin (no CSP change), no package added', () => {
    const src = read('src', 'components', 'analytics', 'SpeedInsights.tsx')
    expect(src).toContain('src="/_vercel/speed-insights/script.js"')
    expect(src.match(/strategy="lazyOnload"/g)).toHaveLength(2)
    expect(src).not.toMatch(/beforeInteractive|afterInteractive/)
    expect(read('package.json')).not.toContain('speed-insights')
    expect(read('next.config.ts')).toContain("\"script-src 'self'")
  })

  it('is mounted once, in the root layout', () => {
    const layout = read('src', 'app', 'layout.tsx')
    expect(layout).toContain("import SpeedInsights from '@/components/analytics/SpeedInsights'")
    expect(layout.match(/<SpeedInsights \/>/g)).toHaveLength(1)
  })
})
