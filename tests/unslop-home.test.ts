import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatFcfa, previewLines, previewTotal, quotePreviewOffers } from '@/lib/quote-preview'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { defaultOffers } from '@/data/defaultData'
import type { Offer } from '@/types'

const root = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8').replace(/\r\n/g, '\n')
const offer = (id: string, o: Partial<Offer> = {}): Offer => ({ id, title: `Offre ${id}`, description: '', priceLabel: 'Sur devis', ...o })

describe('the example quote in the hero: built from the real offers', () => {
  it('takes the offers that have a price (the numeric minimum, or the first amount of the label), featured first, three at most', () => {
    const offers = [
      offer('a', { priceLabel: '80 000 – 100 000 FCFA' }),
      offer('b'), // on quote: no price to show
      offer('c', { priceHTMin: 500000, priceHTMax: 900000 }),
      offer('d', { priceLabel: '150 000 – 300 000 FCFA', featured: true }),
      offer('e', { priceLabel: '25 000 FCFA' }),
    ]
    expect(quotePreviewOffers(offers).map((o) => o.id)).toEqual(['d', 'a', 'c'])
    expect(quotePreviewOffers(offers, 2)).toHaveLength(2)
    expect(quotePreviewOffers([offer('x')])).toEqual([])
  })

  it('shows each starting price as it is in the data, and a total that is their sum', () => {
    const offers = [offer('a', { priceLabel: '80 000 – 100 000 FCFA' }), offer('c', { priceHTMin: 500000, priceHTMax: 900000 })]
    const lines = previewLines(offers, { a: 'Site vitrine' })
    expect(lines).toEqual([{ id: 'a', title: 'Site vitrine', amount: 80000 }, { id: 'c', title: 'Offre c', amount: 500000 }])
    expect(previewTotal(lines)).toBe(580000)
  })

  it('writes amounts the French way and the English way', () => {
    expect(formatFcfa(1500000, 'fr')).toBe('1 500 000 FCFA')
    expect(formatFcfa(80000, 'en')).toBe('80,000 FCFA')
  })

  it('works on the default offers too (never invents a price: every figure comes from an offer)', () => {
    const picked = quotePreviewOffers(defaultOffers)
    for (const o of picked) expect(JSON.stringify(o)).toMatch(/\d/)
    expect(picked.length).toBeLessThanOrEqual(3)
  })

  it('is plainly an example: a visible "Example" mark, no client name, a note saying what the figures are', () => {
    for (const l of ['fr', 'en'] as const) {
      const h = getDictionary(l).home
      expect(h.quotePreviewExample).toMatch(/Exemple|Example/)
      expect(h.quotePreviewClientValue).toMatch(/Votre entreprise|Your company/)
      expect(h.quotePreviewNote).toMatch(/Exemple|Example/)
      expect(h.quotePreviewNote).toMatch(/indicatif|Indicative/)
    }
    const src = read('src', 'components', 'sections', 'QuotePreview.tsx')
    expect(src).toContain('{t.quotePreviewExample}')
    expect(src).toContain('{t.quotePreviewNote}')
    expect(src).toContain('{t.quotePreviewClientValue}')
    expect(src).not.toMatch(/personal\.|testimonial|client\.name/i)
  })

  it('sits in the hero beside the text, only when at least two offers have a price', () => {
    const page = read('src', 'app', '[locale]', 'page.tsx')
    expect(page).toContain('quotePreviewOffers(offers).length >= 2')
    expect(page).toContain('aside={')
    expect(read('src', 'components', 'sections', 'HeroSection.tsx')).toContain('lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]')
  })
})

describe('type: sentence case, weight 600', () => {
  const css = read('src', 'app', 'globals.css')
  const block = (name: string) => new RegExp(`\\.${name} \\{[^}]*\\}`).exec(css)?.[0] ?? ''

  it('no uppercase tracked labels', () => {
    expect(block('section-label')).not.toMatch(/uppercase/)
    expect(block('section-label')).toMatch(/letter-spacing: 0\.01em/)
    expect(read('src', 'components', 'sections', 'FeaturedProjects.tsx')).not.toMatch(/uppercase|tracking-wide/)
  })

  it('titles are at 600, not 700', () => {
    expect(block('section-title')).toMatch(/font-weight: 600/)
    for (const file of [['components', 'sections', 'HeroSection.tsx'], ['app', '[locale]', 'page.tsx'], ['components', 'sections', 'FeaturedProjects.tsx'], ['components', 'layout', 'Footer.tsx']]) {
      expect(read('src', ...file), file.join('/')).not.toContain('font-bold')
    }
  })
})

describe('the hero', () => {
  const hero = read('src', 'components', 'sections', 'HeroSection.tsx')

  it('says what the work is, in a headline that is not a greeting; the name sits beside the photo', () => {
    expect(hero).toContain('{t.heroTitle}')
    expect(hero).toContain('{personal.name}')
    expect(getDictionary('fr').home.heroTitle).toBe('Sites web, applications mobiles, logiciels métiers, SaaS et solutions IA : donnons vie à vos projets numériques.')
    expect(getDictionary('en').home.heroTitle).toBe('Websites, mobile apps, business software, SaaS and AI solutions: let’s bring your digital projects to life.')
    expect(JSON.stringify(getDictionary('fr').home)).not.toContain('Bonjour, je suis')
  })

  it('has no typewriter and no looping cursor, no colour wash behind the text', () => {
    expect(hero).not.toMatch(/animate-pulse|setInterval|TypingCursor|typed/)
    expect(hero).not.toMatch(/radial-gradient|accent-glow/)
  })

  it('the social buttons change colour on hover, nothing grows', () => {
    expect(hero).toContain('transition-colors')
    expect(hero).not.toMatch(/hover:scale|transition-all/)
  })
})

describe('quiet motion and one entrance', () => {
  it('no sliding, growing or transition-all in the footer, the header and the hero', () => {
    for (const file of [['components', 'layout', 'Footer.tsx'], ['components', 'layout', 'Navbar.tsx'], ['components', 'sections', 'HeroSection.tsx']]) {
      const src = read('src', ...file)
      expect(src, file.join('/')).not.toMatch(/transition-all|hover:scale|translateX\(3px\)/)
    }
  })

  it('the cards of the home page do not each fly in: one entrance per section header', () => {
    const page = read('src', 'app', '[locale]', 'page.tsx')
    expect(page).not.toMatch(/delay=\{(Math\.min|0\.1 \+)/)
    expect(read('src', 'components', 'sections', 'FeaturedProjects.tsx')).not.toMatch(/delay=\{/)
  })
})

describe('colour and icons: the accent is kept for the few things that need it', () => {
  const page = read('src', 'app', '[locale]', 'page.tsx')

  it('the figures keep their icon and their count-up (the owner asked for them back); the steps are their number and their words', () => {
    expect(page).toContain('HOME_STATS.map(({ icon, value, label })')
    expect(page).toContain('<Icon name={icon}')
    expect(page).toContain('<CountUp value={value[locale]} />')
    expect(page).not.toMatch(/STEP_ICONS|iconForText/)
    expect(page).toContain('step-number')
  })

  it('the stack icons are muted, and the hero has no teal at all', () => {
    expect(page).toContain("style={{ color: 'var(--text-muted)' }}")
    expect(read('src', 'components', 'sections', 'HeroSection.tsx')).not.toContain('var(--brand')
  })
})
describe('layout: not four equal centred blocks everywhere', () => {
  const page = read('src', 'app', '[locale]', 'page.tsx')

  it('section headings are aligned left, the stack groups have different widths, sections are tighter on a phone', () => {
    expect(page).not.toMatch(/FadeIn className="text-center/)
    expect(page).toContain('lg:grid-cols-3')
    expect(page.match(/py-16 md:py-24/g)?.length).toBeGreaterThanOrEqual(5)
    expect(read('src', 'components', 'sections', 'FeaturedProjects.tsx')).toContain('py-16 md:py-24')
  })

  it('the closing block has two different ways in (the quote, the contact page)', () => {
    expect(page).toContain('href={`/${locale}/devis`} className="btn-primary">{t.home.ctaButton1}')
    expect(page).toContain('href={`/${locale}/contact`} className="btn-secondary">{t.home.ctaButton2}')
  })
})

describe('the real price labels of the site (read from the public offers page)', () => {
  it('give their starting price; one without a currency is left out rather than guessed', async () => {
    const { basePrice } = await import('@/lib/chat-services')
    const labels: [string, number | null][] = [
      ['80 000 – 100 000 FCFA', 80000],
      ['100 000 – 150 000 FCFA', 100000],
      ['150 000 – 300 000 FCFA', 150000],
      [' 300 000 – 1 000 000 FCFA', 300000],
      ['500 000 – 5 000 000 FCFA', 500000],
      ['50 000 – 150 000 FCFA / mois', 50000],
      ['1 000 000 - 5 000 000', null],
    ]
    for (const [label, expected] of labels) expect(basePrice({ priceLabel: label })?.amount ?? null, label).toBe(expected)
  })
})

describe('the count-up', () => {
  it('also counts when the figure is already on screen at load', () => {
    const src = read('src', 'components', 'ui', 'CountUp.tsx')
    expect(src).not.toContain('already on screen: leave the real value')
    expect(src).toContain('IntersectionObserver')
  })
})
