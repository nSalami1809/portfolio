import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const layout = readFileSync(join(__dirname, '..', 'src', 'app', 'admin', 'layout.tsx'), 'utf8')

describe('the back-office shell keeps its side menu in place', () => {
  it('is exactly one screen high, so the page itself never scrolls', () => {
    expect(layout).toMatch(/<div className="h-dvh flex overflow-hidden"/)
    expect(layout).not.toMatch(/min-h-dvh|min-h-screen/)
  })

  it('lets the side menu fill that height instead of sticking inside a taller page', () => {
    expect(layout).toMatch(/<DesktopSidebar style=/)
    expect(layout).not.toMatch(/<DesktopSidebar className="sticky/)
  })

  it('makes <main> the scroll area, and starts every new page at its top', () => {
    expect(layout).toMatch(/<main ref=\{mainRef\} className=\{`flex-1 [^`]*overflow-y-auto/)
    expect(layout).toMatch(/useEffect\(\(\) => \{ mainRef\.current\?\.scrollTo\(\{ top: 0 \}\) \}, \[pathname\]\)/)
  })

  it('declares those hooks before the early return of the login pages', () => {
    const hooks = layout.indexOf('useEffect(() => { mainRef.current')
    const earlyReturn = layout.indexOf("if (pathname === '/admin/login'")
    expect(hooks).toBeGreaterThan(-1)
    expect(hooks).toBeLessThan(earlyReturn)
  })
})
