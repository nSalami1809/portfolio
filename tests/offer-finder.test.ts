import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultOffers } from '@/data/defaultData'
import type { Offer } from '@/types'
import { BUDGETS, DELAYS, GOALS, describeAnswers, offerPriceRange, recommendOffers, scoreOffer, type Answers } from '@/lib/offer-finder'
import OfferFinder from '@/components/offers/OfferFinder'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { whatsappMessage } from '@/lib/whatsapp'

const advise = (goal: Answers['goal'], budget: Answers['budget'], delay: Answers['delay'] = 'normal') => recommendOffers({ goal, budget, delay }, defaultOffers)
const best = (goal: Answers['goal'], budget: Answers['budget'], delay: Answers['delay'] = 'normal') => advise(goal, budget, delay).best?.offer.title

describe('the price range of an offer', () => {
  it('comes from its numeric range, else from the amounts of its label, else nothing', () => {
    expect(offerPriceRange({ priceLabel: 'x', priceHTMin: 100_000, priceHTMax: 200_000 })).toEqual([100_000, 200_000])
    expect(offerPriceRange({ priceLabel: '350 000 – 600 000 FCFA' })).toEqual([350_000, 600_000])
    expect(offerPriceRange({ priceLabel: '80 000 FCFA' })).toEqual([80_000, 80_000])
    expect(offerPriceRange({ priceLabel: '1.500.000 – 3.000.000 FCFA' })).toEqual([1_500_000, 3_000_000])
    expect(offerPriceRange({ priceLabel: 'Sur devis' })).toBeNull()
    expect(offerPriceRange({ priceLabel: '' })).toBeNull()
  })

  it('ignores a numeric range that makes no sense', () => {
    expect(offerPriceRange({ priceLabel: '10 000 FCFA', priceHTMin: 500, priceHTMax: 100 })).toEqual([10_000, 10_000])
  })
})

describe('the advice, on the site\'s real offers', () => {
  it('advises a showcase site for a visitor who wants to present an activity, by budget', () => {
    expect(best('site', 'lt400')).toBe('Site vitrine simple')
    expect(best('site', 'mid')).toBe('Site vitrine complet')
    expect(best('site', 'unknown')).toBe('Site vitrine complet')
  })

  it('advises the shop to a visitor who wants to sell, and says when it is above the budget', () => {
    expect(best('shop', 'high')).toBe('Boutique en ligne')
    const small = advise('shop', 'lt400').best!
    expect(small.offer.title).toBe('Boutique en ligne')
    expect(small.budget).toBe('above')
  })

  it('advises the custom application for a visitor who wants a tool', () => {
    expect(best('app', 'xl')).toBe('Application web sur mesure')
    expect(best('app', 'unknown')).toBe('Application web sur mesure')
  })

  it('does not take a showcase site for a custom application because its description says "sur mesure"', () => {
    for (const budget of BUDGETS) expect(best('app', budget)).toBe('Application web sur mesure')
  })

  it('does not take "carte bancaire" for a shopping cart', () => {
    const payment = defaultOffers.find((o) => o.title.startsWith('Intégration paiement'))!
    expect(scoreOffer(payment, { goal: 'shop', budget: 'mid', delay: 'normal' }).topic).toBe(false)
  })

  it('prefers the offer named API over an offer that only mentions payment', () => {
    expect(best('api', 'mid')).toBe('API / backend seul')
    expect(best('api', 'xl')).toBe('API / backend seul')
  })

  it('advises something for every combination of answers, and never the same offer twice', () => {
    for (const goal of GOALS) for (const budget of BUDGETS) for (const delay of DELAYS) {
      const { best: b, alternatives } = advise(goal, budget, delay)
      expect(b, `${goal}/${budget}/${delay}`).not.toBeNull()
      expect(alternatives.length).toBeLessThanOrEqual(2)
      const ids = [b!.offer.id, ...alternatives.map((a) => a.offer.id)]
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('gives the same advice for the same answers', () => {
    expect(JSON.stringify(advise('site', 'mid'))).toBe(JSON.stringify(advise('site', 'mid')))
  })

  it('favours the simpler offers when the visitor is in a hurry', () => {
    const urgent = scoreOffer(defaultOffers.find((o) => o.title === 'Site vitrine simple')!, { goal: 'site', budget: 'lt400', delay: 'urgent' })
    const relaxed = scoreOffer(defaultOffers.find((o) => o.title === 'Site vitrine simple')!, { goal: 'site', budget: 'lt400', delay: 'relaxed' })
    expect(urgent.score).toBeGreaterThan(relaxed.score)
  })
})

describe('when no offer fits', () => {
  const onlyMaintenance: Offer[] = [{ id: 'm', title: 'Maintenance mensuelle', description: 'Suivi et corrections.', priceLabel: '50 000 FCFA' }]

  it('advises nothing instead of pushing something unrelated', () => {
    expect(recommendOffers({ goal: 'shop', budget: 'mid', delay: 'normal' }, onlyMaintenance)).toEqual({ best: null, alternatives: [] })
    expect(recommendOffers({ goal: 'site', budget: 'mid', delay: 'normal' }, [])).toEqual({ best: null, alternatives: [] })
  })

  it('works with offers that have no price at all ("Sur devis")', () => {
    const onQuote: Offer[] = [{ id: 'q', title: 'Boutique en ligne', description: 'Catalogue et panier.', priceLabel: 'Sur devis' }]
    const r = recommendOffers({ goal: 'shop', budget: 'high', delay: 'normal' }, onQuote)
    expect(r.best?.offer.id).toBe('q')
    expect(r.best?.budget).toBe('unknown')
  })

  it('finds an offer added in the back-office later, with no code change', () => {
    const added: Offer = { id: 'new', title: 'Boutique WhatsApp', description: 'Une boutique en ligne qui prend les commandes sur WhatsApp.', priceLabel: '400 000 – 900 000 FCFA' }
    const r = recommendOffers({ goal: 'shop', budget: 'mid', delay: 'normal' }, [...defaultOffers, added])
    expect(r.best?.offer.id).toBe('new')
    expect(r.best?.budget).toBe('fits')
  })
})

describe('the answers, in one line, for a message to the owner', () => {
  it('names the goal, the budget and the delay the visitor chose', () => {
    const t = getDictionary('fr').finder
    expect(describeAnswers({ goal: 'shop', budget: 'mid', delay: 'urgent' }, { goal: t.goal.options, budget: t.budget.options, delay: t.delay.options }))
      .toBe('Vendre mes produits en ligne · 400 000 – 1 000 000 FCFA · Vite : en moins d’un mois')
  })

  it('goes into a WhatsApp message, with or without an advised offer', () => {
    const withOffer = whatsappMessage({ kind: 'finder', offer: 'Boutique en ligne', answers: 'Vendre · mid' }, 'fr', 'Nawaf')
    expect(withOffer).toContain('« Boutique en ligne »')
    expect(withOffer).toContain('(Vendre · mid)')
    const none = whatsappMessage({ kind: 'finder', answers: 'Vendre · mid' }, 'fr', 'Nawaf')
    expect(none).toContain('aucune offre ne correspond')
    expect(none).not.toContain('« »')
  })
})

describe('the questionnaire on the page', () => {
  const render = (locale: 'fr' | 'en') => renderToStaticMarkup(h(OfferFinder, {
    offers: defaultOffers, translated: {}, t: getDictionary(locale).finder, locale, onRequestQuote: () => undefined, whatsappFor: () => 'https://wa.me/1',
  }))

  it('opens on the first question, with its choices as radio buttons and a progress mark', () => {
    const out = render('fr')
    expect(out).toContain('data-testid="offer-finder"')
    expect(out).toContain('Question 1 sur 3')
    expect(out).toContain('Que voulez-vous réaliser ?')
    expect(out.match(/type="radio"/g)).toHaveLength(5)
    for (const goal of GOALS) expect(out).toContain(`data-testid="finder-goal-${goal}"`)
    expect(out).toContain('<fieldset>')
    expect(out).toContain('<legend')
    // no "back" on the first question, and no result yet
    expect(out).not.toContain('finder-back')
    expect(out).not.toContain('finder-result')
  })

  it('says it saves and sends nothing', () => {
    expect(render('fr')).toContain('Rien n’est enregistré ni envoyé')
    expect(render('en')).toContain('Nothing is saved or sent')
  })

  it('exists in English', () => {
    const out = render('en')
    expect(out).toContain('Question 1 of 3')
    expect(out).toContain('What do you want to build?')
    expect(out).toContain('A website to present my activity')
  })
})

describe('choosing an option', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'components', 'offers', 'OfferFinder.tsx'), 'utf8')

  it('advances on every click, even on the option that is already ticked (after "Back")', () => {
    expect(source).toMatch(/onClick=\{\(\) => choose\(current, value\)\}/)
    // onChange would not fire for an option that is already ticked
    expect(source).not.toMatch(/onChange=\{\(\) => choose/)
  })

  it('advances on Enter, and lets the arrows move the focus without choosing for the visitor', () => {
    expect(source).toMatch(/e\.key === 'Enter'[\s\S]*choose\(key, value\)/)
    expect(source).toMatch(/ArrowDown[\s\S]*ArrowUp[\s\S]*preventDefault\(\)[\s\S]*\.focus\(\)/)
  })
})

describe('the texts of the questionnaire', () => {
  it('cover every goal, budget and delay in both languages', () => {
    for (const locale of ['fr', 'en'] as const) {
      const t = getDictionary(locale).finder
      for (const g of GOALS) expect(t.goal.options[g], `${locale} goal ${g}`).toBeTruthy()
      for (const b of BUDGETS) expect(t.budget.options[b], `${locale} budget ${b}`).toBeTruthy()
      for (const d of DELAYS) expect(t.delay.options[d], `${locale} delay ${d}`).toBeTruthy()
      for (const key of Object.keys(getDictionary('fr').finder.result) as (keyof typeof t.result)[]) expect(t.result[key], `${locale} result.${key}`).toBeTruthy()
    }
  })
})
