import { describe, expect, it } from 'vitest'
import {
  acceptanceSignedClientEmail, deliveryEmail, invoiceEmail, mailLocale, quoteAcceptedEmail, quoteClientCopyEmail,
  quoteSignedClientEmail, receiptEmail, testimonialRequestEmail, type InvoiceMailData,
} from '@/lib/email-client'
import { ITEMS } from './fixtures'

const ADMIN = 'admin@example.com'
const quote = {
  numero: 'DEV-2026-001', accessCode: 'ABC234', signToken: 't'.repeat(43), deliveryToken: 'd'.repeat(43),
  clientNom: 'Jean <b>Test</b>', descriptionProjet: 'Un site <script>alert(1)</script>', items: ITEMS,
  totalHT: 325000, tva: 58500, totalTTC: 383500, validiteJours: 30,
}
const invoice: InvoiceMailData = {
  numero: 'FAC-2026-001', quoteNumero: 'DEV-2026-001', kind: 'acompte', dueAt: '2026-02-01T00:00:00.000Z', netToPay: 115050,
  client: { nom: 'Jean Test' }, terms: { paymentMethods: 'Virement', paymentDetails: '' },
  payment: { paidAt: '2026-02-02T00:00:00.000Z', method: 'Airtel Money', receiptNumero: 'REC-2026-001' },
}

const builders = (locale: 'fr' | 'en') => [
  quoteClientCopyEmail({ ...quote, locale }, ADMIN),
  quoteSignedClientEmail({ ...quote, locale }, ADMIN),
  quoteAcceptedEmail({ ...quote, locale }, ADMIN),
  deliveryEmail({ ...quote, locale, delivery: { deliveredAt: '2026-02-01T00:00:00.000Z', liveUrl: 'https://client.example' } }, ADMIN),
  acceptanceSignedClientEmail({ ...quote, locale }, ADMIN),
  invoiceEmail({ ...invoice, locale }, ADMIN),
  receiptEmail({ ...invoice, locale }, ADMIN),
  testimonialRequestEmail({ clientNom: quote.clientNom, numero: quote.numero, locale }, ADMIN),
]

describe('client emails follow the client language', () => {
  it('defaults to French for anything that is not English', () => {
    expect(mailLocale(undefined)).toBe('fr')
    expect(mailLocale('de')).toBe('fr')
    expect(mailLocale('en')).toBe('en')
  })

  it('links to the French site for a French client', () => {
    for (const mail of builders('fr')) {
      const links = mail.html.match(/https?:\/\/[^"]+\/(fr|en)\//g) ?? []
      for (const link of links) expect(link).toContain('/fr/')
      expect(mail.html).toContain('lang="fr"')
    }
  })

  it('links to the English site — and speaks English — for an English client', () => {
    for (const mail of builders('en')) {
      const links = mail.html.match(/https?:\/\/[^"]+\/(fr|en)\//g) ?? []
      for (const link of links) expect(link).toContain('/en/')
      expect(mail.html).toContain('lang="en"')
      expect(mail.html).toContain('generated automatically')
      expect(mail.subject).not.toMatch(/Votre|Devis|Facture|Reçu|Recette|avis/)
    }
  })

  it('points each document to its own page', () => {
    expect(quoteClientCopyEmail({ ...quote, locale: 'en' }, ADMIN).html).toContain(`/en/devis/signature/${quote.signToken}`)
    expect(deliveryEmail({ ...quote, locale: 'fr' }, ADMIN).html).toContain(`/fr/recette/${quote.deliveryToken}`)
    expect(acceptanceSignedClientEmail({ ...quote, locale: 'fr' }, ADMIN).html).toContain(`/fr/recette/${quote.deliveryToken}`)
    expect(quoteSignedClientEmail({ ...quote, locale: 'fr' }, ADMIN).html).toContain('/fr/suivi?ref=ABC234')
  })

  it('escapes what the client typed', () => {
    const html = quoteClientCopyEmail({ ...quote, locale: 'fr' }, ADMIN).html
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>Test</b>')
  })

  it('a deposit invoice is due on receipt; a balance invoice on its date', () => {
    expect(invoiceEmail({ ...invoice, locale: 'fr' }, ADMIN).html).toContain('Dès réception')
    expect(invoiceEmail({ ...invoice, locale: 'en' }, ADMIN).html).toContain('On receipt')
    expect(invoiceEmail({ ...invoice, kind: 'solde', locale: 'fr' }, ADMIN).html).not.toContain('Dès réception')
  })
})

describe('tracking code in every client email', () => {
  it('prints the code in each one', async () => {
    const { quoteExpiringEmail, invoiceOverdueEmail, recetteReminderEmail, recetteDeemedEmail } = await import('@/lib/email-client')
    const inv = { numero: 'FAC-2026-001', quoteNumero: 'DEV-2026-001', kind: 'acompte' as const, dueAt: '2026-03-01T00:00:00.000Z', netToPay: 1000, client: { nom: 'Jean' }, terms: { paymentMethods: 'Virement', paymentDetails: '' }, accessCode: 'ABC234' }
    const mails = [
      quoteClientCopyEmail({ ...quote, clientNom: 'Jean' } as never, ADMIN),
      quoteSignedClientEmail(quote as never, ADMIN),
      quoteAcceptedEmail(quote as never, ADMIN),
      deliveryEmail(quote as never, ADMIN),
      acceptanceSignedClientEmail(quote as never, ADMIN),
      invoiceEmail(inv, ADMIN),
      receiptEmail({ ...inv, payment: { paidAt: '2026-03-02T00:00:00.000Z', method: 'x', receiptNumero: 'REC-1' } }, ADMIN),
      testimonialRequestEmail({ accessCode: 'ABC234', clientNom: 'Jean', numero: 'DEV-2026-001' }, ADMIN),
      quoteExpiringEmail({ accessCode: 'ABC234', numero: 'DEV-2026-001', signToken: 't'.repeat(43), clientNom: 'Jean', expiresAt: '2026-03-10T00:00:00.000Z', daysLeft: 2 }, ADMIN),
      invoiceOverdueEmail({ ...inv, reminderNumber: 1 }, ADMIN),
      recetteReminderEmail({ accessCode: 'ABC234', numero: 'DEV-2026-001', deliveryToken: 'd'.repeat(43), clientNom: 'Jean', deemedAt: '2026-03-10T00:00:00.000Z' }, ADMIN),
      recetteDeemedEmail({ accessCode: 'ABC234', numero: 'DEV-2026-001', clientNom: 'Jean', warrantyDays: 30, warrantyEnd: '2026-04-10T00:00:00.000Z' }, ADMIN),
    ]
    mails.forEach((m, i) => expect(m.html, `mail #${i}`).toContain('ABC234'))
  })
})
