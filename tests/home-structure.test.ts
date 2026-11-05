import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDictionary } from '@/lib/i18n/dictionaries'

const root = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')

describe('header navigation', () => {
  const nav = read('src', 'components', 'layout', 'Navbar.tsx')

  it('has four entries at the first level: projects, experience, resources, offers', () => {
    const links = nav.slice(nav.indexOf('const links = ['), nav.indexOf('const quoteHref'))
    expect((links.match(/^    \{$/gm) ?? []).length).toBe(4)
    for (const label of ['t.projects', 't.resume', 't.resources', 't.workOffers']) expect(links).toContain(`label: ${label},`)
  })

  it('puts Vision under Experience, the guides, documents and lab under Resources', () => {
    expect(nav).toMatch(/label: t\.resume,\s*children: \[[\s\S]*?\/vision/)
    expect(nav).toMatch(/label: t\.resources,\s*children: \[[\s\S]*?\/guides[\s\S]*?\/documents[\s\S]*?\/playground/)
  })

  it('keeps tracking, terms of sale and booking a call under Offers (not at the first level)', () => {
    expect(nav).toMatch(/label: t\.workOffers,[\s\S]*?\/calendrier[\s\S]*?\/suivi[\s\S]*?\/cgv/)
  })

  it('has a quote button that is always shown (outside the part hidden on desktop)', () => {
    expect(nav).toContain('href={quoteHref}')
    expect(nav).toContain('{t.quote}')
    expect(nav.indexOf('href={quoteHref}')).toBeLessThan(nav.indexOf('xl:hidden">'))
  })

  it('has its texts in French and in English', () => {
    expect(getDictionary('fr').nav.quote).toBe('Devis')
    expect(getDictionary('en').nav.quote).toBe('Quote')
    expect(getDictionary('fr').nav.resources).toBe('Ressources')
    expect(getDictionary('en').nav.resources).toBe('Resources')
  })
})
