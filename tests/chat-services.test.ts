import { describe, it, expect } from 'vitest'
import {
  PRICE_DISCLAIMER, basePrice, bookingHref, contactHref, fromPriceLabel, lastVisitorText, normalizeAccessCode, quoteProgress,
  quoteRequestMessage, serviceCards, teaserAllowed, trackingHref, trackingMessage,
} from '@/lib/chat-services'
import type { Offer } from '@/types'

const offer = (over: Partial<Offer> = {}): Offer => ({ id: 'o1', title: 'Site vitrine', description: 'Un site clair pour présenter votre activité.', priceLabel: '350 000 – 600 000 FCFA', features: ['Design sur mesure', 'SEO de base', 'Formulaire', 'Hébergement'], ...over })

describe('starting price of each offer', () => {
  it('uses the numeric minimum of the offer when it has one, marked excluding tax', () => {
    expect(basePrice({ priceHTMin: 350000, priceLabel: 'Sur devis' })).toEqual({ amount: 350000, ht: true })
    expect(fromPriceLabel('fr', { amount: 350000, ht: true })).toBe('À partir de 350 000 FCFA HT')
    expect(fromPriceLabel('en', { amount: 350000, ht: true })).toBe('From 350,000 FCFA excl. tax')
  })

  it('reads the first amount of the price label otherwise', () => {
    expect(basePrice({ priceLabel: '600 000 – 1 000 000 FCFA' })).toEqual({ amount: 600000, ht: false })
    expect(basePrice({ priceLabel: 'À partir de 1.200.000 F CFA' })).toEqual({ amount: 1200000, ht: false })
    expect(basePrice({ priceLabel: '150 000 FCFA' })).toEqual({ amount: 150000, ht: false })
    expect(basePrice({ priceLabel: '45000 XAF' })).toEqual({ amount: 45000, ht: false })
    expect(fromPriceLabel('fr', { amount: 150000, ht: false })).toBe('À partir de 150 000 FCFA')
  })

  it('says "on quote" instead of inventing a number', () => {
    for (const priceLabel of ['Sur devis', '', 'Gratuit', 'Nous consulter']) expect(basePrice({ priceLabel }), priceLabel).toBeNull()
    expect(basePrice({ priceHTMin: 0, priceLabel: 'Sur devis' })).toBeNull()
    expect(fromPriceLabel('fr', null)).toBe('Sur devis')
    expect(fromPriceLabel('en', null)).toBe('On quote')
  })

  it('follows each offer, including one added later, with no fixed floor', () => {
    const cards = serviceCards([
      offer({ id: 'a', title: 'Vitrine', priceLabel: '350 000 – 600 000 FCFA' }),
      offer({ id: 'b', title: 'Mini', priceLabel: '80 000 FCFA' }),
      offer({ id: 'c', title: 'Nouvelle offre', priceLabel: '2 500 000 FCFA', priceHTMin: undefined }),
      offer({ id: 'd', title: 'Sur mesure', priceLabel: 'Sur devis' }),
    ])
    expect(cards.map((c) => c.price?.amount ?? null)).toEqual([350000, 80000, 2500000, null])
    expect(cards.map((c) => c.price?.amount).filter((n) => n === 100000)).toHaveLength(0)
  })

  it('is always presented as indicative', () => {
    expect(PRICE_DISCLAIMER.fr).toMatch(/indicatif/i)
    expect(PRICE_DISCLAIMER.en).toMatch(/indicative/i)
  })
})

describe('service cards', () => {
  it('are built from the real offers, with at most 3 features and no invented price', () => {
    const [card] = serviceCards([offer()])
    expect(card).toMatchObject({ id: 'o1', title: 'Site vitrine', priceDetail: '350 000 – 600 000 FCFA' })
    expect(card.features).toEqual(['Design sur mesure', 'SEO de base', 'Formulaire'])
  })

  it('skips untitled offers, caps the number and hides "sur devis" as a price detail', () => {
    const many = Array.from({ length: 9 }, (_, i) => offer({ id: `o${i}`, title: `Offre ${i}` }))
    expect(serviceCards([offer({ title: '  ' }), ...many])).toHaveLength(6)
    expect(serviceCards([offer({ priceLabel: 'Sur devis' })])[0].priceDetail).toBeNull()
    expect(serviceCards([offer({ priceLabel: '' })])[0].priceDetail).toBeNull()
  })

  it('shortens long descriptions', () => {
    const [card] = serviceCards([offer({ description: 'mot '.repeat(80) })])
    expect(card.summary.length).toBeLessThanOrEqual(110)
    expect(card.summary.endsWith('…')).toBe(true)
  })

  it('writes the quote request in the visitor language', () => {
    expect(quoteRequestMessage('fr', 'Site vitrine')).toBe('Je souhaite un devis pour : Site vitrine.')
    expect(quoteRequestMessage('en', 'Showcase site')).toBe("I'd like a quote for: Showcase site.")
  })
})

describe('quote tracking', () => {
  it('accepts a 6-character code however it is typed', () => {
    expect(normalizeAccessCode('abc234')).toBe('ABC234')
    expect(normalizeAccessCode(' ABC-234 ')).toBe('ABC234')
    expect(normalizeAccessCode('ABC 234')).toBe('ABC234')
  })

  it('rejects anything else, including the look-alike characters the codes never use', () => {
    for (const bad of ['', 'ABC12', 'ABC2345', 'ABCO23', 'ABCI23', 'DEV-2026-014', 'AB<>23']) expect(normalizeAccessCode(bad), bad).toBeNull()
  })

  it('builds the tracking link and message', () => {
    expect(trackingHref('fr', 'ABC234')).toBe('/fr/suivi?ref=ABC234')
    expect(trackingMessage('fr', 'ABC234')).toContain('ABC234')
    expect(trackingMessage('en', 'ABC234')).toContain('access code')
  })

  it('reads progress from the facts on the quote', () => {
    expect(quoteProgress({ status: 'pending' }, 'fr').current).toBe(1)
    expect(quoteProgress({ status: 'accepted', signature: {} }, 'fr').current).toBe(2)
    expect(quoteProgress({ status: 'accepted', signature: {}, delivery: {} }, 'fr').current).toBe(3)
    const full = quoteProgress({ status: 'accepted', signature: {}, delivery: {}, acceptance: {} }, 'en')
    expect(full.current).toBe(4)
    expect(full.steps.map((s) => s.label)).toEqual(['Quote issued', 'Signed', 'Delivered', 'Acceptance signed'])
    expect(quoteProgress({ status: 'declined' }, 'fr').declined).toBe(true)
  })
})

describe('talking to the owner', () => {
  it('prefills the contact form with a bounded message', () => {
    expect(contactHref('fr')).toBe('/fr/contact')
    expect(contactHref('fr', 'Bonjour & merci')).toBe('/fr/contact?message=Bonjour%20%26%20merci')
    expect(decodeURIComponent(contactHref('en', 'x'.repeat(900)).split('=')[1]).length).toBe(500)
    expect(bookingHref('en')).toBe('/en/calendrier')
  })

  it('finds the visitor\'s latest question', () => {
    const messages = [
      { role: 'user', parts: [{ type: 'text', text: 'Bonjour' }] },
      { role: 'assistant', parts: [{ type: 'text', text: 'Salut' }] },
      { role: 'user', parts: [{ type: 'text', text: '  Combien\n pour une boutique ?  ' }] },
      { role: 'assistant', parts: [{ type: 'tool-generateQuote' }] },
    ]
    expect(lastVisitorText(messages)).toBe('Combien pour une boutique ?')
    expect(lastVisitorText([])).toBe('')
  })
})

describe('invitation bubble', () => {
  it('stays away from signing, acceptance, tracking and admin pages', () => {
    expect(teaserAllowed('/fr')).toBe(true)
    expect(teaserAllowed('/en/offres')).toBe(true)
    expect(teaserAllowed('/fr/devis')).toBe(true)
    expect(teaserAllowed('/fr/devis/signature/abc')).toBe(false)
    expect(teaserAllowed('/fr/recette/abc')).toBe(false)
    expect(teaserAllowed('/fr/suivi')).toBe(false)
    expect(teaserAllowed('/admin/quotes')).toBe(false)
    expect(teaserAllowed(null)).toBe(false)
  })
})
