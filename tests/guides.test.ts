import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GUIDES, getGuide, type GuideBlock } from '@/data/guides'
import GuideBody, { paymentOffer } from '@/components/guides/GuideBody'
import { DEFAULT_BUSINESS } from '@/lib/business'
import { defaultOffers } from '@/data/defaultData'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Offer } from '@/types'
import sitemap from '@/app/sitemap'

// the sitemap reads the portfolio; here there is no database, so it falls back on the pages it knows
vi.mock('@/lib/portfolio-data', () => ({ fetchPortfolioSafe: async () => null }))

const root = join(__dirname, '..', 'src')
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

describe('the guides', () => {
  it('have clean, unique, URL-safe names', () => {
    expect(GUIDES.length).toBeGreaterThanOrEqual(2)
    const slugs = GUIDES.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(SLUG)
    expect(getGuide('combien-coute-un-site-web')).toBeDefined()
    expect(getGuide('accepter-le-paiement-mobile-money')).toBeDefined()
    expect(getGuide('nope')).toBeUndefined()
  })

  it('are written in both languages, with the same structure', () => {
    for (const g of GUIDES) {
      expect(g.updated, g.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(g.fr.sections.map((s) => s.blocks.map((b) => b.kind))).toEqual(g.en.sections.map((s) => s.blocks.map((b) => b.kind)))
      for (const locale of ['fr', 'en'] as const) {
        const t = g[locale]
        expect(t.title.length, `${g.slug}/${locale} title`).toBeGreaterThan(10)
        expect(t.description.length).toBeGreaterThan(40)
        expect(t.description.length, 'a description fit for a search result').toBeLessThan(200)
        expect(t.intro.length).toBeGreaterThan(80)
        expect(t.readMinutes).toBeGreaterThan(0)
        expect(t.ctaTitle).toBeTruthy()
        expect(t.ctaText).toBeTruthy()
        expect(t.sections.length).toBeGreaterThanOrEqual(5)
      }
      expect(g.fr.title).not.toBe(g.en.title)
    }
  })

  it('give every section a unique anchor and a heading', () => {
    for (const g of GUIDES) for (const locale of ['fr', 'en'] as const) {
      const ids = g[locale].sections.map((s) => s.id)
      expect(new Set(ids).size, `${g.slug}/${locale}`).toBe(ids.length)
      for (const s of g[locale].sections) {
        expect(s.id).toMatch(SLUG)
        expect(s.heading.length).toBeGreaterThan(5)
      }
    }
  })

  it('state no price, no deposit, no delay and no payment rule of their own: those are read from the site', () => {
    const text = JSON.stringify(GUIDES)
    // an amount of money, a percentage or a number of days written in the texts would contradict a quote one day
    expect(text).not.toMatch(/\d{1,3}(?:[ \u00a0\u202f.,]\d{3})+\s?(?:FCFA|XAF|F CFA)/i)
    expect(text).not.toMatch(/\b\d+\s?%/)
    expect(text).not.toMatch(/\b\d+\s?(?:jours|days)\b/i)
  })

  it('name no payment operator and promise no fee, delay or rule of one', () => {
    const payment = JSON.stringify(getGuide('accepter-le-paiement-mobile-money'))
    expect(payment).not.toMatch(/airtel|moov|orange|mtn|wave|singpay|stripe|paypal/i)
    expect(payment).toMatch(/dépendent de l’opérateur|depend on the operator/)
  })

  it('use the facts blocks where a fact would be, in the right guide', () => {
    const kinds = (slug: string) => getGuide(slug)!.fr.sections.flatMap((s) => s.blocks.map((b: GuideBlock) => b.kind))
    expect(kinds('combien-coute-un-site-web')).toEqual(expect.arrayContaining(['prices', 'terms']))
    expect(kinds('accepter-le-paiement-mobile-money')).toContain('payment')
  })
})

describe('the body of a guide, drawn with the site\'s real data', () => {
  const t = getDictionary('fr')
  const body = (slug: string, offers: Offer[] = defaultOffers, business = DEFAULT_BUSINESS, locale: 'fr' | 'en' = 'fr') =>
    renderToStaticMarkup(h(GuideBody, { sections: getGuide(slug)![locale].sections, offers, business, t: getDictionary(locale).guides, work: getDictionary(locale).work, locale }))

  it('lists every priced offer with its own price, read from the offers', () => {
    const out = body('combien-coute-un-site-web')
    expect(out).toContain('data-testid="guide-prices"')
    for (const o of defaultOffers) { expect(out).toContain(o.title.replace('&', '&amp;')); expect(out).toContain(o.priceLabel) }
  })

  it('follows the offers: a new offer, or a changed price, shows up with no change to the guide', () => {
    const changed: Offer[] = [{ id: 'z', title: 'Offre ajoutée hier', description: 'x', priceLabel: '123 456 FCFA' }]
    const out = body('combien-coute-un-site-web', changed)
    expect(out).toContain('Offre ajoutée hier')
    expect(out).toContain('123 456 FCFA')
    expect(out).not.toContain('Site vitrine simple')
  })

  it('says so, instead of an empty table, when there is no priced offer', () => {
    const out = body('combien-coute-un-site-web', [])
    expect(out).not.toContain('<table')
    expect(out).toContain(t.guides.noPrices)
  })

  it('shows the real terms: deposit, lead time, revisions, warranty, source code', () => {
    const custom = { ...DEFAULT_BUSINESS, depositPercent: 40, deliveryDays: 21, includedRevisions: 3, warrantyDays: 45 }
    const out = body('combien-coute-un-site-web', defaultOffers, custom)
    expect(out).toContain('data-testid="guide-terms"')
    // each condition has its own icon: clock, wallet, pen, shield, code
    const terms = /data-testid="guide-terms"[\s\S]*?<\/dl>/.exec(out)?.[0] ?? ''
    expect(terms.match(/<svg/g)?.length ?? 0).toBeGreaterThanOrEqual(5)
    expect(new Set(terms.match(/<svg[^>]*>[\s\S]*?<\/svg>/g)).size).toBeGreaterThanOrEqual(5)
    expect(out).toContain('40 %')
    expect(out).toContain('21 j')
    expect(out).toContain('45 j')
    expect(out).toContain('>3<')
  })

  it('shows the payment offer and the payment methods accepted for quotes', () => {
    const out = body('accepter-le-paiement-mobile-money', defaultOffers, { ...DEFAULT_BUSINESS, paymentMethods: 'Virement, Mobile Money' })
    expect(out).toContain('data-testid="guide-payment"')
    expect(out).toContain('Intégration paiement en ligne')
    expect(out).toContain('Virement, Mobile Money')
    expect(paymentOffer(defaultOffers)?.title).toBe('Intégration paiement en ligne')
  })

  it('stays honest when there is no payment offer', () => {
    const out = body('accepter-le-paiement-mobile-money', defaultOffers.filter((o) => !/paiement/i.test(o.title)))
    expect(out).toContain(t.guides.paymentNone)
  })

  it('gives each section its anchor and heading, in English too', () => {
    const out = body('combien-coute-un-site-web', defaultOffers, DEFAULT_BUSINESS, 'en')
    for (const s of getGuide('combien-coute-un-site-web')!.en.sections) {
      expect(out).toContain(`id="${s.id}"`)
      expect(out).toContain(s.heading)
    }
  })
})

describe('where the guides can be found', () => {
  it('are in the menu, under "Travailler avec moi"', () => {
    const nav = readFileSync(join(root, 'components', 'layout', 'Navbar.tsx'), 'utf8')
    expect(nav).toMatch(/\/guides`, label: t\.workGuides/)
    expect(getDictionary('fr').nav.workGuides).toBeTruthy()
    expect(getDictionary('en').nav.workGuides).toBeTruthy()
  })

  it('are in the sitemap, the list and every guide, in both languages', async () => {
    const urls = (await sitemap()).map((e) => e.url)
    for (const locale of ['fr', 'en']) {
      expect(urls.some((u) => u.endsWith(`/${locale}/guides`)), `${locale} list`).toBe(true)
      for (const g of GUIDES) expect(urls.some((u) => u.endsWith(`/${locale}/guides/${g.slug}`)), `${locale} ${g.slug}`).toBe(true)
    }
  })

  it('are built ahead of time for every language and guide, and an unknown name is a 404', () => {
    const page = readFileSync(join(root, 'app', '[locale]', 'guides', '[slug]', 'page.tsx'), 'utf8')
    expect(page).toMatch(/generateStaticParams/)
    expect(page).toMatch(/if \(!guide\) notFound\(\)/)
    expect(page).toContain("'@type': 'Article'")
  })

  it('end on a way to act: quote, offer finder, WhatsApp', () => {
    const page = readFileSync(join(root, 'app', '[locale]', 'guides', '[slug]', 'page.tsx'), 'utf8')
    expect(page).toContain('/devis')
    expect(page).toContain('#trouver-mon-offre')
    expect(page).toMatch(/kind: 'guide'/)
    const finder = readFileSync(join(root, 'components', 'offers', 'OfferFinder.tsx'), 'utf8')
    expect(finder).toContain('id="trouver-mon-offre"')
  })
})
