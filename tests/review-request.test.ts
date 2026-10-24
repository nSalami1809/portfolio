import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { reviewPageUrl, reviewRequestWhatsApp } from '@/lib/review-request'
import { whatsappUrl } from '@/lib/whatsapp'

const url = 'https://example.test/fr/temoignage'

describe('the WhatsApp message that asks for a review', () => {
  it('greets the client by their first name and carries the link to the review page', () => {
    const m = reviewRequestWhatsApp({ clientName: 'Marie Ondo', locale: 'fr', reviewUrl: url, ownerName: 'Nawaf Nemrod SALAMI' })
    expect(m.startsWith('Bonjour Marie 👋')).toBe(true)
    expect(m).toContain(url)
    expect(m).toContain('avis')
    expect(m.trimEnd().endsWith('Nawaf')).toBe(true)
  })

  it('exists in English', () => {
    const m = reviewRequestWhatsApp({ clientName: 'John Smith', locale: 'en', reviewUrl: 'https://example.test/en/temoignage', ownerName: 'Nawaf' })
    expect(m.startsWith('Hello John 👋')).toBe(true)
    expect(m).toContain('review')
    expect(m).toContain('/en/temoignage')
  })

  it('does not break on a missing or odd name', () => {
    for (const name of [undefined, null, '', '   ', 'X']) {
      const m = reviewRequestWhatsApp({ clientName: name, locale: 'fr', reviewUrl: url })
      expect(m.startsWith('Bonjour 👋'), String(name)).toBe(true)
    }
  })

  it('asks politely and promises nothing: no discount, no reward, no pressure', () => {
    for (const locale of ['fr', 'en'] as const) {
      const m = reviewRequestWhatsApp({ clientName: 'Marie', locale, reviewUrl: url })
      expect(m).not.toMatch(/remise|réduction|cadeau|gratuit|discount|free|reward|offer/i)
    }
  })

  it('fits in a WhatsApp link', () => {
    const link = whatsappUrl('+241 07 12 34 56', reviewRequestWhatsApp({ clientName: 'Marie', locale: 'fr', reviewUrl: url }))
    expect(link.startsWith('https://wa.me/24107123456?text=')).toBe(true)
    expect(link.length).toBeLessThan(1000)
  })
})

describe('the link to the review page', () => {
  it('is on the site, in the client\'s language, without a doubled slash', () => {
    expect(reviewPageUrl('https://example.test', 'fr')).toBe('https://example.test/fr/temoignage')
    expect(reviewPageUrl('https://example.test/', 'en')).toBe('https://example.test/en/temoignage')
  })
})

describe('in the back-office', () => {
  const root = join(__dirname, '..', 'src')
  const panel = readFileSync(join(root, 'components', 'admin', 'QuoteWorkflowPanel.tsx'), 'utf8')
  const actions = readFileSync(join(root, 'actions', 'quotes.ts'), 'utf8')

  it('offers the request only once the client has signed the PV without reserve', () => {
    expect(panel).toMatch(/const reviewBlock = quote\.acceptance && !quote\.acceptance\.reserves \?/)
  })

  it('lets the owner choose e-mail or WhatsApp, and sends nothing without a click and a confirmation', () => {
    expect(panel).toMatch(/confirm\(`Envoyer la demande d’avis par e-mail à/)
    expect(panel).toContain('data-testid="review-whatsapp"')
    expect(panel).toContain("window.open(url, '_blank', 'noopener,noreferrer')")
  })

  it('records a request made outside the site, which also stops the automatic one from asking twice', () => {
    const action = /export async function markTestimonialAsked[\s\S]*?\n}\n/.exec(actions)?.[0] ?? ''
    expect(action).toMatch(/await requireAdmin\(\)/)
    expect(action).toContain('testimonialRequestedAt: new Date()')
    // the automatic request at the end of the warranty only asks when nobody has asked yet
    const reminders = readFileSync(join(root, 'lib', 'reminders.ts'), 'utf8')
    expect(reminders).toMatch(/!q\.testimonialRequested/)
  })
})
