import type { Quote } from '@/actions/quotes'
import type { PersonalInfo } from '@/types'
import { computeTotals, snapshotTerms } from '@/lib/business'

// Fixed, fictional data — the golden wording tests depend on it never changing.
export const PERSONAL: PersonalInfo = {
  name: 'Prestataire Test',
  role: 'Développeur Web',
  bio: '',
  email: 'prestataire@example.com',
  location: 'Libreville, Gabon — Disponible en remote',
  photo: '',
  whatsapp: '+241 00 00 00 00',
  signatureUrl: '',
  business: {
    legalStatus: 'Prestataire indépendant',
    registrationNumber: 'RCCM-TEST',
    taxId: 'NIF-TEST',
    address: '1 rue Test, Libreville, Gabon',
    vatEnabled: true,
    vatRate: 18,
    paymentMethods: 'Virement bancaire, Airtel Money',
    paymentDetails: 'SECRET-PAYMENT-COORDINATES',
    depositPercent: 30,
    depositRefundable: false,
    paymentDueDays: 7,
    latePenaltyRate: 1.5,
    deliveryDays: 30,
    includedRevisions: 2,
    warrantyDays: 30,
    sourceCodeDelivery: true,
  },
}

export const SITE = 'https://site.example'
export const DATE = '2026-01-15T10:00:00.000Z'

export const ITEMS = [
  { designation: 'Site vitrine (Standard)', quantite: 1, prixUnitaireHT: 250000 },
  { designation: 'Hébergement et mise en ligne', quantite: 2, prixUnitaireHT: 37500 },
]

export function makeQuote(overrides: Partial<Quote> = {}, business: PersonalInfo['business'] = PERSONAL.business): Quote {
  const personal = { ...PERSONAL, business }
  const terms = snapshotTerms(personal)
  const totals = computeTotals(ITEMS, terms)
  return {
    clientNom: 'Client Test', clientSociete: 'Société Test', clientAdresse: 'Port-Gentil',
    clientEmail: 'client@example.com', clientTelephone: '+241 11 11 11 11',
    descriptionProjet: 'Un site vitrine avec formulaire de contact.',
    items: ITEMS, numero: 'DEV-2026-001', accessCode: 'ABC234', signToken: 'x'.repeat(43),
    dateEmission: DATE, validiteJours: 30, ...totals,
    status: 'pending', kind: 'devis', terms, docVersion: 1, events: [],
    ...overrides,
  }
}

export const withBusiness = (patch: NonNullable<PersonalInfo['business']>): PersonalInfo => ({ ...PERSONAL, business: { ...PERSONAL.business, ...patch } })
