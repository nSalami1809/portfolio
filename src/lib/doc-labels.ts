// Fixed labels printed around the legal text of the business documents (titles,
// column headings, signature boxes, footers…), in both languages. Used by the
// PDF generators and by the on-screen QuoteView so the two always say the same.
// The clauses themselves are in quote-document.ts (fr) / quote-document-en.ts (en).
import type { DocLang } from '@/lib/doc-common'

export interface DocLabels {
  no: string
  trackingCode: string
  issueDate: string
  offerValidity: string
  days: (n: number) => string
  deliveryDate: string
  reference: string
  refAvenant: (numero: string) => string
  refDevis: (numero: string) => string
  provider: string
  client: string
  defaultRole: string
  project: string
  avenantOf: (parent: string) => string
  items: string
  table: { designation: string; qty: string; priceHT: string; price: string; totalHT: string; total: string; unitHT: string; unit: string }
  totals: { ht: string; ttc: string; total: string }
  vat: (rate: string) => string
  titles: { devis: string; contrat: string; avenant: string; pv: string; factureAcompte: string; factureSolde: string; recu: string }
  files: { devis: string; contrat: string; avenant: string; pv: string; facture: string; recu: string }
  signature: {
    title: string; signed: string; by: string; email: string; when: string; doc: string; hash: string
    client: string; provider: string; providerOffer: string; providerMissing: string; pvDoc: (numero: string) => string
    contractParties: string; contractLine: string; devisLine: string; devisHeading: (n: number) => string
    pvHeading: string; pvLine: string
  }
  pv: { withReserves: string; withoutReserves: string }
  footer: { signedBoth: string; pending: string; offer: string; generated: string }
  watermark: (word: string) => string
  page: (i: number, total: number) => string
  invoice: {
    issuer: string; receivedBy: string; receivedFrom: string; payment: string; detail: string
    paid: string; amountReceived: string; method: string; ref: string; forInvoice: (inv: string, doc: string, quote: string) => string
    paymentDate: string; invoiceNo: string; dueOnReceipt: string; due: string
    deduction: string; net: string; settlementTitle: string
    depositPayable: string; payableBy: (d: string) => string; accepted: (m: string) => string; details: (d: string) => string
    late: (rate: string) => string; settled: (d: string, receipt: string) => string; cancelled: string
    docRef: (docWord: string, quote: string) => string; sigProvider: string
  }
  docWord: { devis: string; avenant: string }
}

const FR: DocLabels = {
  no: 'N°',
  trackingCode: 'Code de suivi',
  issueDate: "Date d'émission",
  offerValidity: "Validité de l'offre",
  days: (n) => `${n} jours`,
  deliveryDate: 'Date de livraison',
  reference: 'Référence',
  refAvenant: (n) => `avenant ${n}`,
  refDevis: (n) => `devis ${n}`,
  provider: 'PRESTATAIRE',
  client: 'CLIENT',
  defaultRole: 'Développeur freelance',
  project: 'PROJET',
  avenantOf: (p) => `Avenant au contrat lié au devis n° ${p}.`,
  items: 'DÉTAIL DES PRESTATIONS',
  table: { designation: 'DÉSIGNATION', qty: 'QTÉ', priceHT: 'PRIX HT', price: 'PRIX', totalHT: 'TOTAL HT', total: 'TOTAL', unitHT: 'PRIX UNIT. HT', unit: 'PRIX UNIT.' },
  totals: { ht: 'Total HT', ttc: 'Total TTC', total: 'Total' },
  vat: (rate) => `TVA (${rate} %)`,
  titles: { devis: 'DEVIS', contrat: 'CONTRAT', avenant: 'AVENANT', pv: 'PROCÈS-VERBAL DE RECETTE', factureAcompte: "FACTURE D'ACOMPTE", factureSolde: 'FACTURE DE SOLDE', recu: 'REÇU DE PAIEMENT' },
  files: { devis: 'Devis', contrat: 'Contrat', avenant: 'Avenant', pv: 'PV de recette', facture: 'Facture', recu: 'Reçu' },
  signature: {
    title: 'SIGNATURE ÉLECTRONIQUE', signed: 'STATUT : SIGNÉ', by: 'Signé par', email: 'E-mail', when: 'Date et heure', doc: 'Document signé',
    hash: 'Référence (SHA-256)', client: 'Signature du client', provider: 'Signature du prestataire', providerOffer: 'Signature du prestataire (offre)',
    providerMissing: 'Signature du prestataire non configurée', pvDoc: (n) => `PV ${n}`,
    contractParties: 'SIGNATURE DES PARTIES', contractLine: 'Commande confirmée — Date et signature du client :',
    devisLine: 'Bon pour accord — Date et signature du client :', devisHeading: (n) => `${n}. ACCEPTATION DU DEVIS`,
    pvHeading: 'SIGNATURE DU CLIENT', pvLine: 'Recette prononcée - Date et signature du client :',
  },
  pv: { withReserves: 'RECETTE AVEC RÉSERVES', withoutReserves: 'RECETTE SANS RÉSERVE' },
  footer: {
    signedBoth: 'Document généré électroniquement - signé par les deux parties',
    pending: 'Document généré électroniquement - en attente de signature du Client',
    offer: 'Document généré électroniquement - offre ferme du Prestataire',
    generated: 'Document généré électroniquement',
  },
  watermark: (w) => `${w} - document fictif, sans valeur`,
  page: (i, total) => `Page ${i} / ${total}`,
  invoice: {
    issuer: 'ÉMETTEUR', receivedBy: 'REÇU PAR', receivedFrom: 'REÇU DE', payment: 'PAIEMENT', detail: 'DÉTAIL',
    paid: 'PAYE', amountReceived: 'Montant reçu', method: 'Mode de règlement', ref: 'Référence',
    forInvoice: (inv, doc, quote) => `Pour l'acquit de la facture n° ${inv} (${doc} n° ${quote}).`,
    paymentDate: 'Date du paiement', invoiceNo: 'Facture n°', dueOnReceipt: 'à réception', due: 'Échéance',
    deduction: 'Acompte déjà réglé', net: 'Net à payer', settlementTitle: 'MODALITÉS DE RÈGLEMENT',
    depositPayable: "Cette facture d'acompte est payable dès réception : le développement débute après son paiement.",
    payableBy: (d) => `Cette facture est payable au plus tard le ${d}.`,
    accepted: (m) => `Moyens de paiement acceptés : ${m}.`,
    details: (d) => `Coordonnées de paiement : ${d}`,
    late: (r) => `En cas de retard de paiement, des pénalités de ${r} % par mois de retard (tout mois commencé étant dû) sont applicables de plein droit, sans mise en demeure préalable.`,
    settled: (d, r) => `ACQUITTÉE le ${d} - reçu n° ${r}`, cancelled: 'FACTURE ANNULÉE - ne pas régler',
    docRef: (w, q) => `Réf. ${w} ${q}`, sigProvider: 'Signature du prestataire',
  },
  docWord: { devis: 'devis', avenant: 'avenant' },
}

const EN: DocLabels = {
  no: 'No.',
  trackingCode: 'Tracking code',
  issueDate: 'Issue date',
  offerValidity: 'Offer validity',
  days: (n) => `${n} day${n > 1 ? 's' : ''}`,
  deliveryDate: 'Delivery date',
  reference: 'Reference',
  refAvenant: (n) => `amendment ${n}`,
  refDevis: (n) => `quote ${n}`,
  provider: 'SERVICE PROVIDER',
  client: 'CLIENT',
  defaultRole: 'Freelance developer',
  project: 'PROJECT',
  avenantOf: (p) => `Amendment to the contract linked to quote no. ${p}.`,
  items: 'SERVICES',
  table: { designation: 'DESCRIPTION', qty: 'QTY', priceHT: 'PRICE EXCL. TAX', price: 'PRICE', totalHT: 'TOTAL EXCL. TAX', total: 'TOTAL', unitHT: 'UNIT PRICE EXCL. TAX', unit: 'UNIT PRICE' },
  totals: { ht: 'Total excl. tax', ttc: 'Total incl. tax', total: 'Total' },
  vat: (rate) => `VAT (${rate}%)`,
  titles: { devis: 'QUOTE', contrat: 'CONTRACT', avenant: 'AMENDMENT', pv: 'ACCEPTANCE REPORT', factureAcompte: 'DEPOSIT INVOICE', factureSolde: 'BALANCE INVOICE', recu: 'PAYMENT RECEIPT' },
  files: { devis: 'Quote', contrat: 'Contract', avenant: 'Amendment', pv: 'Acceptance report', facture: 'Invoice', recu: 'Receipt' },
  signature: {
    title: 'ELECTRONIC SIGNATURE', signed: 'STATUS: SIGNED', by: 'Signed by', email: 'Email', when: 'Date and time', doc: 'Signed document',
    hash: 'Reference (SHA-256)', client: 'Client signature', provider: 'Service provider signature', providerOffer: 'Service provider signature (offer)',
    providerMissing: 'Service provider signature not set up', pvDoc: (n) => `Acceptance report ${n}`,
    contractParties: 'SIGNATURES OF THE PARTIES', contractLine: 'Order confirmed — Client date and signature:',
    devisLine: 'Approved — Client date and signature:', devisHeading: (n) => `${n}. ACCEPTANCE OF THE QUOTE`,
    pvHeading: 'CLIENT SIGNATURE', pvLine: 'Acceptance granted - Client date and signature:',
  },
  pv: { withReserves: 'ACCEPTANCE WITH RESERVATIONS', withoutReserves: 'ACCEPTANCE WITHOUT RESERVATION' },
  footer: {
    signedBoth: 'Electronically generated document - signed by both parties',
    pending: 'Electronically generated document - awaiting the Client signature',
    offer: 'Electronically generated document - firm offer of the Service Provider',
    generated: 'Electronically generated document',
  },
  watermark: (w) => `${w} - fictitious document, no value`,
  page: (i, total) => `Page ${i} / ${total}`,
  invoice: {
    issuer: 'ISSUED BY', receivedBy: 'RECEIVED BY', receivedFrom: 'RECEIVED FROM', payment: 'PAYMENT', detail: 'DETAILS',
    paid: 'PAID', amountReceived: 'Amount received', method: 'Payment method', ref: 'Reference',
    forInvoice: (inv, doc, quote) => `In settlement of invoice no. ${inv} (${doc} no. ${quote}).`,
    paymentDate: 'Payment date', invoiceNo: 'Invoice no.', dueOnReceipt: 'on receipt', due: 'Due',
    deduction: 'Deposit already paid', net: 'Net to pay', settlementTitle: 'PAYMENT TERMS',
    depositPayable: 'This deposit invoice is payable on receipt: development starts once it is paid.',
    payableBy: (d) => `This invoice is payable no later than ${d}.`,
    accepted: (m) => `Accepted payment methods: ${m}.`,
    details: (d) => `Payment details: ${d}`,
    late: (r) => `In case of late payment, penalties of ${r}% per month of delay (any started month being due) apply automatically, without prior formal notice.`,
    settled: (d, r) => `PAID on ${d} - receipt no. ${r}`, cancelled: 'INVOICE CANCELLED - do not pay',
    docRef: (w, q) => `Ref. ${w} ${q}`, sigProvider: 'Service provider signature',
  },
  docWord: { devis: 'quote', avenant: 'amendment' },
}

export const docLabels = (lang: DocLang): DocLabels => (lang === 'en' ? EN : FR)
