// Single source of truth for the provider's legal identity and commercial
// terms. Read by the devis/contrat/facture/PV builders, the CGV page and the
// legal notice — so a change made once in /admin/personal reaches every
// document — and *snapshotted* onto each quote at creation (see QuoteTerms):
// a client who signed at 30 % deposit / 18 % VAT must never see those numbers
// silently change on their signed document because the settings were edited
// afterwards.
import type { BusinessSettings, PersonalInfo } from '@/types'

export type ResolvedBusiness = Required<BusinessSettings>

// Starting values used until the provider fills the matching field in
// /admin/personal. They mirror what the documents already said before these
// settings existed (30 % deposit, 18 % VAT, 30 days of warranty).
export const DEFAULT_BUSINESS: ResolvedBusiness = {
  legalStatus: '',
  registrationNumber: '',
  taxId: '',
  address: '',
  vatEnabled: true,
  vatRate: 18,
  vatExemptionMention: 'TVA non applicable',
  paymentMethods: 'Virement bancaire, Mobile Money (Airtel Money, Moov Money)',
  paymentDetails: '',
  depositPercent: 30,
  depositRefundable: false,
  paymentDueDays: 7,
  latePenaltyRate: 1.5,
  deliveryDays: 30,
  includedRevisions: 2,
  warrantyDays: 30,
  sourceCodeDelivery: true,
}

// French decimal comma (1,5 not 1.5) for rates printed in the documents.
export const frNumber = (n: number) => String(n).replace('.', ',')

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
const text = (s: unknown, fallback: string) => (typeof s === 'string' ? s.trim() : fallback)

export function resolveBusiness(personal?: Pick<PersonalInfo, 'business'> | null): ResolvedBusiness {
  const b = personal?.business ?? {}
  const d = DEFAULT_BUSINESS
  return {
    legalStatus: text(b.legalStatus, d.legalStatus),
    registrationNumber: text(b.registrationNumber, d.registrationNumber),
    taxId: text(b.taxId, d.taxId),
    address: text(b.address, d.address),
    vatEnabled: typeof b.vatEnabled === 'boolean' ? b.vatEnabled : d.vatEnabled,
    vatRate: clamp(b.vatRate, 0, 100, d.vatRate),
    vatExemptionMention: text(b.vatExemptionMention, d.vatExemptionMention) || d.vatExemptionMention,
    paymentMethods: text(b.paymentMethods, d.paymentMethods) || d.paymentMethods,
    paymentDetails: text(b.paymentDetails, d.paymentDetails),
    depositPercent: clamp(b.depositPercent, 0, 100, d.depositPercent),
    depositRefundable: typeof b.depositRefundable === 'boolean' ? b.depositRefundable : d.depositRefundable,
    paymentDueDays: Math.round(clamp(b.paymentDueDays, 0, 365, d.paymentDueDays)),
    latePenaltyRate: clamp(b.latePenaltyRate, 0, 100, d.latePenaltyRate),
    deliveryDays: Math.round(clamp(b.deliveryDays, 1, 730, d.deliveryDays)),
    includedRevisions: Math.round(clamp(b.includedRevisions, 0, 50, d.includedRevisions)),
    warrantyDays: Math.round(clamp(b.warrantyDays, 0, 730, d.warrantyDays)),
    sourceCodeDelivery: typeof b.sourceCodeDelivery === 'boolean' ? b.sourceCodeDelivery : d.sourceCodeDelivery,
  }
}

// Who the provider is, frozen at the moment a quote is created.
export interface ProviderIdentity {
  name: string
  role: string
  location: string
  email: string
  whatsapp?: string
  signatureUrl?: string
}

export interface QuoteTerms extends ResolvedBusiness {
  provider: ProviderIdentity
}

export function providerIdentity(personal: PersonalInfo): ProviderIdentity {
  return {
    name: personal.name,
    role: personal.role,
    location: personal.location,
    email: personal.email,
    ...(personal.whatsapp ? { whatsapp: personal.whatsapp } : {}),
    ...(personal.signatureUrl ? { signatureUrl: personal.signatureUrl } : {}),
  }
}

export function snapshotTerms(personal: PersonalInfo): QuoteTerms {
  return { ...resolveBusiness(personal), provider: providerIdentity(personal) }
}

// Quotes created before these settings existed carry no snapshot: they were
// issued under the historical defaults, with the provider's identity as it is
// now (there was nothing else to freeze).
export function resolveTerms(quote: { terms?: QuoteTerms }, personal: PersonalInfo): QuoteTerms {
  if (quote.terms) return quote.terms
  const { legalStatus, registrationNumber, taxId, address } = resolveBusiness(personal)
  return { ...DEFAULT_BUSINESS, legalStatus, registrationNumber, taxId, address, provider: providerIdentity(personal) }
}

export function computeTotals(items: { quantite: number; prixUnitaireHT: number }[], terms: Pick<ResolvedBusiness, 'vatEnabled' | 'vatRate'>) {
  const totalHT = items.reduce((sum, it) => sum + it.quantite * it.prixUnitaireHT, 0)
  const tva = terms.vatEnabled ? Math.round((totalHT * terms.vatRate) / 100) : 0
  return { totalHT, tva, totalTTC: totalHT + tva }
}

// Deposit / balance split, in TTC — the same arithmetic is used by the devis,
// the contract and the invoices so the three can never disagree by a franc.
export function splitPayment(totalTTC: number, depositPercent: number) {
  const acompte = Math.round((totalTTC * depositPercent) / 100)
  return { acompte, solde: totalTTC - acompte }
}

export function vatLabel(terms: Pick<ResolvedBusiness, 'vatEnabled' | 'vatRate'>): string {
  return terms.vatEnabled ? `TVA (${frNumber(terms.vatRate)} %)` : 'TVA'
}

// Extract the HT/TVA share of an amount entered TTC (deposit invoices).
export function splitTTC(amountTTC: number, terms: Pick<ResolvedBusiness, 'vatEnabled' | 'vatRate'>) {
  if (!terms.vatEnabled) return { ht: amountTTC, tva: 0 }
  const ht = Math.round(amountTTC / (1 + terms.vatRate / 100))
  return { ht, tva: amountTTC - ht }
}

// One-line "legal identity" for a document header/footer: only the fields that
// are actually filled in.
export function identityLines(b: Pick<ResolvedBusiness, 'legalStatus' | 'registrationNumber' | 'taxId'>): string[] {
  const lines: string[] = []
  if (b.legalStatus) lines.push(b.legalStatus)
  if (b.registrationNumber) lines.push(`RCCM : ${b.registrationNumber}`)
  if (b.taxId) lines.push(`NIF : ${b.taxId}`)
  return lines
}
