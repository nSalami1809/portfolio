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
    expect(page.indexOf('<FeaturedProjects')).toBeLessThan(page.indexOf('id="apropos"'))
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

describe('one single stack block, twelve key technologies in four groups', () => {
  it('the ribbon under the hero is gone, the grouped section is the only one', () => {
    const page = read('src', 'app', '[locale]', 'page.tsx')
    expect(page).not.toContain('TechMarquee')
    expect(page).toContain('HOME_STACK.map(')
    expect(page).not.toContain('skills.map(')
    expect(() => read('src', 'components', 'sections', 'TechMarquee.tsx')).toThrow()
    expect(read('src', 'app', 'globals.css')).not.toContain('tech-marquee')
  })

  it('has Frontend, Backend, DevOps and AI, with 10 to 12 technologies in all', async () => {
    const { HOME_STACK } = await import('@/data/home-stack')
    expect(HOME_STACK.map((g) => g.id)).toEqual(['frontend', 'backend', 'devops', 'ai'])
    const total = HOME_STACK.reduce((n, g) => n + g.items.length, 0)
    expect(total).toBeGreaterThanOrEqual(10)
    expect(total).toBeLessThanOrEqual(12)
  })

  it('gives every technology a logo or a generic icon, and never lists Git, GitHub and GitHub Actions together', async () => {
    const { HOME_STACK } = await import('@/data/home-stack')
    const { techLogo } = await import('@/lib/tech-logos')
    const names = HOME_STACK.flatMap((g) => g.items.map((i) => ({ name: typeof i.name === 'string' ? i.name : i.name.fr, icon: i.icon })))
    for (const { name, icon } of names) expect(icon || techLogo(name), name).toBeTruthy()
    expect(names.filter((n) => /^git/i.test(n.name)).length).toBeLessThanOrEqual(1)
  })
})

describe('technology logos', () => {
  it('find the right file whatever the spelling, even the misspelling in the data', async () => {
    const { techLogo } = await import('@/lib/tech-logos')
    expect(techLogo('Next.js')).toBe('/tech/nextdotjs.svg')
    expect(techLogo('NODE JS')).toBe('/tech/nodedotjs.svg')
    expect(techLogo('Boostrap')).toBe('/tech/bootstrap.svg')
    expect(techLogo('GitHub Actions')).toBe('/tech/githubactions.svg')
    expect(techLogo('REST / GraphQL')).toBe('/tech/graphql.svg')
    expect(techLogo('R.A.G')).toBeNull()
    expect(techLogo('Power Bi')).toBeNull()
  })

  it('every logo the lookup points to exists, and is one flat single-colour shape (no colours of its own)', async () => {
    const { readdirSync } = await import('node:fs')
    const files = readdirSync(join(root, 'public', 'tech'))
    const src = read('src', 'lib', 'tech-logos.ts')
    const used = [...src.matchAll(/:\s*'([a-z0-9]+)',/g)].map((m) => `${m[1]}.svg`)
    for (const f of new Set(used)) expect(files, f).toContain(f)
    for (const f of files) {
      const svg = read('public', 'tech', f)
      expect(svg, f).not.toMatch(/fill="#|stroke="#|<image|<style|<script/i)
    }
  })

  it('are painted in the text colour, the same size everywhere, with no picture uploaded in the admin', () => {
    expect(read('src', 'app', 'globals.css')).toMatch(/\.tech-logo \{[\s\S]*?background-color: currentColor;[\s\S]*?mask: var\(--tech-logo\)/)
    const resume = read('src', 'app', '[locale]', 'resume', 'ResumeView.tsx')
    expect(resume).toContain('<TechLogo name={item} />')
    expect(resume).not.toContain('skill.icons')
    expect(read('src', 'app', '[locale]', 'page.tsx')).not.toContain('.icons')
  })
})
