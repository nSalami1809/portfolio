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

describe('hero', () => {
  const hero = read('src', 'components', 'sections', 'HeroSection.tsx')

  it('puts the instant quote first and the projects second', () => {
    expect(hero.indexOf('/devis`')).toBeGreaterThan(-1)
    expect(hero.indexOf('/devis`')).toBeLessThan(hero.indexOf('/projects`'))
    expect(hero).toContain('{t.heroCtaQuote}')
    expect(hero).toContain('{t.heroCtaProjects}')
  })

  it('keeps a visible way for recruiters to the experience page', () => {
    expect(hero).toContain('/resume`')
    expect(hero).toContain('{t.heroRecruit}')
  })

  it('shows two sentences, not the long profile (which moves to the About block)', () => {
    expect(hero).toContain('{t.heroSummary}')
    expect(hero).not.toContain('personal.bio')
    for (const locale of ['fr', 'en'] as const) {
      const summary = getDictionary(locale).home.heroSummary
      expect(summary.split(/\.\s/).length, locale).toBeLessThanOrEqual(2)
      expect(summary.length, locale).toBeLessThan(260)
    }
    expect(read('src', 'app', '[locale]', 'page.tsx')).toContain('translatedPersonal.bio')
  })

  it('has the same title as the one search engines show', async () => {
    const { HOME_COPY } = await import('@/lib/seo')
    for (const locale of ['fr', 'en'] as const) {
      expect(getDictionary(locale).home.heroRoleLabel).toBe(HOME_COPY[locale].title)
    }
  })
})

describe('featured projects', () => {
  const base = { image: undefined as string | undefined, caseStudyContext: undefined as string | undefined, caseStudyResults: undefined as string | undefined }
  const p = (slug: string, o: Record<string, unknown> = {}) => ({ slug, status: 'completed' as const, ...base, ...o })

  it('takes at most three, the ones that explain themselves best first, never a concept', async () => {
    const { pickFeaturedProjects } = await import('@/lib/featured-projects')
    const list = [
      p('a'), p('b', { image: 'x', caseStudyContext: 'c', caseStudyResults: 'r' }), p('c', { status: 'concept', image: 'x', caseStudyContext: 'c' }),
      p('d', { image: 'x' }), p('e', { image: 'x', caseStudyContext: 'c' }), p('f', { status: 'in-progress', image: 'x', caseStudyContext: 'c' }),
    ]
    expect(pickFeaturedProjects(list).map((x) => x.slug)).toEqual(['b', 'e', 'd'])
    expect(pickFeaturedProjects(list, 5).map((x) => x.slug)).not.toContain('c')
  })

  it('keeps the order of the list among equals, and copes with fewer than three', async () => {
    const { pickFeaturedProjects } = await import('@/lib/featured-projects')
    expect(pickFeaturedProjects([p('x'), p('y'), p('z')]).map((q) => q.slug)).toEqual(['x', 'y', 'z'])
    expect(pickFeaturedProjects([p('only')]).length).toBe(1)
    expect(pickFeaturedProjects([])).toEqual([])
  })

  it('sits right after the hero, in its own Suspense boundary, and reads the existing projects', () => {
    const page = read('src', 'app', '[locale]', 'page.tsx')
    expect(page.indexOf('<FeaturedProjects')).toBeGreaterThan(page.indexOf('<HeroSection'))
    expect(page.indexOf('<FeaturedProjects')).toBeLessThan(page.indexOf('<TechMarquee'))
    expect(page).toContain('projects={portfolio?.projects ?? defaultProjects}')
    expect(page).toMatch(/<Suspense fallback=\{<FeaturedProjectsSkeleton \/>\}>/)
  })

  it('shows the need, the result only when there is one, the stack and the link to the case study', () => {
    const src = read('src', 'components', 'sections', 'FeaturedProjects.tsx')
    expect(src).toContain('{t.featuredNeed}')
    expect(src).toContain('{result && (')
    expect(src).toContain('p.tags.slice(0, 5)')
    expect(src).toContain('/projects/${p.slug}')
    expect(src).toContain('<ProjectPicture')
  })

  it('has its texts in both languages', () => {
    for (const locale of ['fr', 'en'] as const) {
      const h = getDictionary(locale).home
      for (const k of ['featuredLabel', 'featuredTitle', 'featuredNeed', 'featuredResult', 'featuredCase', 'featuredProject', 'featuredAll'] as const) expect(h[k], `${locale}.${k}`).toBeTruthy()
    }
  })
})

describe('the chosen featured projects', () => {
  const mk = (slug: string, o: Record<string, unknown> = {}) => ({ slug, status: 'completed' as const, image: undefined as string | undefined, caseStudyContext: undefined as string | undefined, caseStudyResults: undefined as string | undefined, ...o })

  it('are TSWE, FPBG and Yamna, in that order', async () => {
    const { FEATURED_PROJECT_SLUGS, pickFeaturedProjects } = await import('@/lib/featured-projects')
    expect(FEATURED_PROJECT_SLUGS).toEqual(['tswe', 'fpbg', 'yam-na'])
    const list = [mk('chatbot-assistant-ia', { image: 'x', caseStudyContext: 'c', caseStudyResults: 'r' }), mk('yam-na'), mk('fpbg'), mk('tswe')]
    expect(pickFeaturedProjects(list).map((p) => p.slug)).toEqual(['tswe', 'fpbg', 'yam-na'])
  })

  it('keep their place even when in progress, and a missing one is replaced by the best-explained other project', async () => {
    const { pickFeaturedProjects } = await import('@/lib/featured-projects')
    const list = [mk('autre', { image: 'x' }), mk('tswe', { status: 'in-progress' }), mk('yam-na'), mk('concept', { status: 'concept', image: 'x' })]
    expect(pickFeaturedProjects(list).map((p) => p.slug)).toEqual(['tswe', 'yam-na', 'autre'])
  })
})

describe('hero buttons', () => {
  it('the recruiter button looks like the projects button (same kind, same row)', () => {
    const hero = read('src', 'components', 'sections', 'HeroSection.tsx')
    expect(hero).toMatch(/\/projects`\} className="btn-secondary"/)
    expect(hero).toMatch(/\/resume`\} className="btn-secondary"/)
    expect(hero).not.toContain('underline-offset-4')
  })
})
