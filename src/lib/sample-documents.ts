// Sample business documents for the public "Travailler avec moi" page: the
// real generators, fed with a fictional client and the provider's *current*
// settings, so the samples always show today's wording, figures and signature.
// Every page carries an "EXEMPLE" watermark and banner — a sample must never
// be mistakable for an issued document.
import type { Quote } from '@/actions/quotes'
import type { Invoice } from '@/lib/invoicing'
import type { PersonalInfo, Offer } from '@/types'
import { computeTotals, snapshotTerms, splitPayment, splitTTC } from '@/lib/business'
import { generateQuotePdf } from '@/lib/quote-pdf'
import { generateInvoicePdf } from '@/lib/invoice-pdf'

export const SAMPLE_KINDS = ['devis', 'contrat', 'pv', 'facture', 'recu'] as const
export type SampleKind = (typeof SAMPLE_KINDS)[number]

const WATERMARK = 'EXEMPLE'

function sampleItems(offers: Offer[]) {
  const priced = offers
    .filter((o) => typeof o.priceHTMin === 'number' && typeof o.priceHTMax === 'number' && (o.priceHTMin ?? 0) > 0)
    .slice(0, 2)
    .map((o) => ({
      designation: `${o.title} (Standard)`,
      quantite: 1,
      prixUnitaireHT: Math.round(((o.priceHTMin as number) + (o.priceHTMax as number)) / 2),
    }))
  return priced.length
    ? priced
    : [
        { designation: 'Site vitrine (Standard)', quantite: 1, prixUnitaireHT: 250000 },
        { designation: 'Hébergement et mise en ligne', quantite: 1, prixUnitaireHT: 75000 },
      ]
}

export async function generateSampleDocument(kind: SampleKind, personal: PersonalInfo, offers: Offer[], siteUrl: string): Promise<{ filename: string; content: Buffer }> {
  // Public page: never print the real payment coordinates (an Airtel/IBAN
  // number typed for invoices) on a sample anyone can open.
  const snapshot = snapshotTerms(personal)
  const terms = { ...snapshot, paymentDetails: snapshot.paymentDetails ? 'Indiquées sur votre facture' : '' }
  const items = sampleItems(offers)
  const totals = computeTotals(items, terms)
  const now = new Date()
  const iso = now.toISOString()
  const numero = 'EXEMPLE-001'

  const quote: Quote = {
    clientNom: 'Client Exemple', clientSociete: 'Société Exemple', clientAdresse: 'Ville Exemple',
    clientEmail: 'client@exemple.com', clientTelephone: '+000 00 00 00 00',
    descriptionProjet: "Exemple de projet : un site vitrine avec formulaire de contact, pour illustrer le contenu d'un devis.",
    items, numero, accessCode: 'EXEMPL', dateEmission: iso, validiteJours: 30, ...totals,
    status: 'pending', kind: 'devis', terms, events: [],
    delivery: { deliveredAt: iso, note: 'Exemple de livraison.' },
  }

  if (kind === 'devis' || kind === 'contrat' || kind === 'pv') {
    const content = await generateQuotePdf({
      quote: kind === 'devis' ? { ...quote, delivery: undefined } : quote,
      personal, variant: kind, siteUrl, watermark: WATERMARK,
    })
    const label = { devis: 'Devis', contrat: 'Contrat', pv: 'Proces-verbal-de-recette' }[kind]
    return { filename: `Exemple-${label}.pdf`, content }
  }

  const { acompte } = splitPayment(totals.totalTTC, terms.depositPercent)
  const hasDeposit = terms.depositPercent > 0 && terms.depositPercent < 100
  const gross = hasDeposit ? acompte : totals.totalTTC
  const split = splitTTC(gross, terms)
  const invoice: Invoice = {
    id: 'exemple', numero: 'FAC-EXEMPLE', quoteNumero: numero, quoteKind: 'devis',
    kind: hasDeposit ? 'acompte' : 'solde', status: kind === 'recu' ? 'paid' : 'issued',
    issuedAt: iso, dueAt: iso,
    lines: hasDeposit
      ? [{ designation: `Acompte de ${terms.depositPercent} % sur devis n° ${numero}`, quantite: 1, prixUnitaireHT: split.ht }]
      : items,
    totalHT: hasDeposit ? split.ht : totals.totalHT, tva: hasDeposit ? split.tva : totals.tva, totalTTC: gross,
    deductions: [], netToPay: gross,
    client: { nom: 'Client Exemple', societe: 'Société Exemple', email: 'client@exemple.com' },
    terms,
    ...(kind === 'recu' ? { payment: { paidAt: iso, method: terms.paymentMethods.split(',')[0]?.trim() || 'Virement bancaire', receiptNumero: 'REC-EXEMPLE' } } : {}),
  }
  const content = await generateInvoicePdf({
    invoice, document: kind === 'recu' ? 'recu' : 'facture', siteUrl, signatureUrl: personal.signatureUrl || undefined, watermark: WATERMARK,
  })
  return { filename: kind === 'recu' ? 'Exemple-Recu.pdf' : 'Exemple-Facture.pdf', content }
}
