import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Offer } from '@/types'

// The panels only import these two server actions to call them on a click: never run here.
vi.mock('@/actions/quotes', () => ({ sendQuoteEmail: vi.fn(), submitQuote: vi.fn() }))
vi.mock('@/actions/assistant', () => ({}))

import { EmailCopyButton, PageHintBox, QuoteConfirm, SlotPicker } from '@/components/chat/ChatFlowPanels'
import { QuoteProgress, ServiceCards, ThumbButtons } from '@/components/chat/ChatPanels'

const noop = () => undefined
const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el)
const offer = (over: Partial<Offer> = {}): Offer => ({ id: 'o1', title: 'Site vitrine', description: 'Un site clair.', priceLabel: '350 000 – 600 000 FCFA', features: ['SEO'], ...over })

describe('service cards show each offer\'s own starting price', () => {
  it('prints the minimum of each offer, marked indicative, and "Sur devis" without a number', () => {
    const out = html(h(ServiceCards, {
      offers: [offer({ id: 'a', title: 'Vitrine', priceLabel: '350 000 – 600 000 FCFA' }), offer({ id: 'b', title: 'Mini', priceLabel: '80 000 FCFA' }), offer({ id: 'c', title: 'Mesure', priceLabel: 'Sur devis' }), offer({ id: 'd', title: 'Pro', priceLabel: '', priceHTMin: 900000, priceHTMax: 1500000 })],
      failed: false, locale: 'fr', busy: false, onRequestQuote: noop, onBack: noop,
    }))
    const prices = [...out.matchAll(/data-testid="chat-service-price"[^>]*>([^<]*)</g)].map((m) => m[1].replace(/ /g, ' '))
    expect(prices).toEqual(['À partir de 350 000 FCFA', 'À partir de 80 000 FCFA', 'Sur devis', 'À partir de 900 000 FCFA HT'])
    expect(out).not.toContain('100 000')
    expect(out.match(/Prix indicatif/g)).toHaveLength(4)
  })

  it('shows a loading line, then a neutral message when the offers could not be read', () => {
    expect(html(h(ServiceCards, { offers: null, failed: false, locale: 'fr', busy: false, onRequestQuote: noop, onBack: noop }))).toContain('Chargement')
    expect(html(h(ServiceCards, { offers: null, failed: true, locale: 'fr', busy: false, onRequestQuote: noop, onBack: noop }))).toContain('ne sont pas disponibles')
  })
})

describe('slot buttons', () => {
  const days = [{ date: '2026-10-22', slots: ['09:00', '09:30', '14:00'] }, { date: '2026-10-23', slots: [] }]

  it('has one button per free slot, each carrying its exact day and time', () => {
    const out = html(h(SlotPicker, { days, locale: 'fr', busy: false, onPick: noop }))
    expect([...out.matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1])).toEqual(['2026-10-22T09:00', '2026-10-22T09:30', '2026-10-22T14:00'])
    expect(out).toContain('jeudi 22 octobre')
    expect(out).toContain('Libreville')
  })

  it('says so when nothing is free, and disables the buttons while a request runs', () => {
    expect(html(h(SlotPicker, { days: [], locale: 'fr', busy: false, onPick: noop }))).toContain('Aucun créneau')
    expect(html(h(SlotPicker, { days, locale: 'en', busy: true, onPick: noop }))).toMatch(/<button[^>]*disabled/)
  })
})

describe('quote confirmation card', () => {
  const input = { clientNom: 'Awa Mbeki', descriptionProjet: 'Un site vitrine', items: [{ designation: 'Site vitrine (Standard)', quantite: 1, prixUnitaireHT: 450000 }, { designation: 'Hébergement', quantite: 2, prixUnitaireHT: 50000 }] }

  it('shows what was understood and the computed total, with confirm and change buttons', () => {
    const out = html(h(QuoteConfirm, { input, locale: 'fr', busy: false, onConfirm: noop, onEdit: noop }))
    expect(out).toContain("Voici ce que j&#x27;ai compris de votre projet")
    expect(out).toContain('Awa Mbeki')
    expect(out).toContain('Site vitrine (Standard)')
    expect(out.replace(/ | /g, ' ')).toMatch(/550 000 FCFA/)
    expect(out).toContain('Générer mon devis')
    expect(out).toContain('Modifier')
  })

  it('cannot be confirmed with no line, and shows the working state', () => {
    const empty = html(h(QuoteConfirm, { input: { clientNom: 'A' }, locale: 'fr', busy: false, onConfirm: noop, onEdit: noop }))
    expect(empty).toMatch(/<button[^>]*disabled[^>]*>Générer mon devis/)
    expect(html(h(QuoteConfirm, { input, locale: 'fr', busy: true, onConfirm: noop, onEdit: noop }))).toContain('Génération du devis')
  })
})

describe('other panels', () => {
  it('offers to email the quote to the address already on it, or asks for one', () => {
    expect(html(h(EmailCopyButton, { accessCode: 'ABC234', clientEmail: 'awa@studio.example', locale: 'fr' }))).toContain('Envoyer à awa@studio.example')
    expect(html(h(EmailCopyButton, { accessCode: 'ABC234', locale: 'en' }))).toContain('Email me this quote')
  })

  it('shows the page and its chips', () => {
    const out = html(h(PageHintBox, { suggestions: { label: 'Mon projet', chips: [{ label: 'Parler de ce projet', text: 'x' }] }, locale: 'fr', busy: false, onChip: noop }))
    expect(out).toContain('Mon projet')
    expect(out).toContain('Parler de ce projet')
  })

  it('has accessible, pressed-aware thumbs and a four-step quote progress', () => {
    const thumbs = html(h(ThumbButtons, { rating: 'down', locale: 'fr', onRate: noop }))
    expect(thumbs).toContain('aria-label="Réponse à améliorer" aria-pressed="true"')
    expect(thumbs).toContain('Merci pour votre retour')
    const progress = html(h(QuoteProgress, { quote: { status: 'accepted', signature: {} }, locale: 'fr' }))
    expect(progress.match(/role="listitem"/g)).toHaveLength(4)
    expect(progress).toContain('Signé')
  })
})
