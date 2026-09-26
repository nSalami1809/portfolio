// English wording of the devis / contrat / avenant / procès-verbal (quote,
// contract, amendment, acceptance report) — the counterpart of the French
// builders in quote-document.ts, clause for clause. A quote issued from the
// English version of the site (quote.locale === 'en') is written in English
// end to end and signed in English.
//
// Same rule as the French wording: it is versioned. Do not edit a released
// clause in place — copy the builders into a new version (and do the same for
// the French set), so a contract somebody already signed never changes.
import type { Quote } from '@/actions/quotes'
import type { PersonalInfo } from '@/types'
import { resolveTerms, splitPayment, type QuoteTerms, type ResolvedBusiness } from '@/lib/business'
import {
  addBusinessDays, computeQuoteDates, fmt as fmtMoney, formatLongDate as formatDate, numbered, parseLocation,
  FORMAL_NOTICE_DAYS, RECETTE_DAYS, paymentMethodsFor, vatExemptionFor, type DocBlock,
} from '@/lib/doc-common'

const fmt = (n: number) => fmtMoney(n, 'en')
const date = (d: Date | string) => formatDate(d, 'en')
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const vatMention = (t: ResolvedBusiness) => vatExemptionFor(t.vatExemptionMention, 'en')

// ── Building blocks shared by the quote and the contract ────────────────────

function paymentBlockEn(quote: Pick<Quote, 'totalTTC'>, t: ResolvedBusiness): Pick<DocBlock, 'bullets' | 'paragraphs'> {
  const { acompte, solde } = splitPayment(quote.totalTTC, t.depositPercent)
  const hasDeposit = t.depositPercent > 0 && t.depositPercent < 100
  const tax = t.vatEnabled ? 'incl. tax' : ''
  const bullets = hasDeposit
    ? [
        `Deposit of ${t.depositPercent}% on signature: ${fmt(acompte)}`,
        `Balance of ${100 - t.depositPercent}% on final delivery: ${fmt(solde)}`,
        `Total: ${fmt(quote.totalTTC)} ${tax}`.trim(),
      ]
    : [`Full payment on final delivery: ${fmt(quote.totalTTC)} ${tax}`.trim()]

  const paragraphs = [
    hasDeposit
      ? 'Development starts once the deposit has been received.'
      : 'The Service Provider may make the start of development conditional on receipt of the agreed payment.',
    hasDeposit
      ? `An invoice is issued for each instalment. The deposit invoice is payable on receipt, development starting once it is paid; the balance invoice is payable within ${plural(t.paymentDueDays, 'day', 'days')} of its issue. A receipt is issued on receipt of each payment.`
      : `The invoice is payable within ${plural(t.paymentDueDays, 'day', 'days')} of its issue; a receipt is issued on receipt of payment.`,
    `Accepted payment methods: ${paymentMethodsFor(t.paymentMethods, 'en')}.`,
    `Any late payment automatically incurs, without prior formal notice, late-payment penalties at the rate of ${t.latePenaltyRate}% per month of delay (any started month being due), and entitles the Service Provider to suspend performance of the services until all sums due have been paid in full.`,
  ]
  if (hasDeposit) {
    paragraphs.push(
      t.depositRefundable
        ? 'If the project is cancelled or abandoned at the Client’s initiative, the deposit is refunded less the value of the services already performed.'
        : 'The deposit is non-refundable if the project is cancelled or abandoned at the Client’s initiative; it remains with the Service Provider in return for reserving their availability and for the work already undertaken.',
    )
  }
  if (!t.vatEnabled) paragraphs.push(vatMention(t))
  return { bullets, paragraphs }
}

function deliveryDelayParagraphsEn(t: ResolvedBusiness): string[] {
  return [
    `The delivery time is estimated at ${plural(t.deliveryDays, 'working day', 'working days')}, depending on the size and complexity of the project described in the quote. It starts on the later of the following two dates: receipt of the deposit (or of the first payment due), and receipt of all the content, access and information needed for the project.`,
    'This time is suspended during the Client’s validation or response periods, and extended accordingly if the items to be provided are late. It is reviewed by amendment if the scope of the project changes.',
    `If the deadline is exceeded for a reason attributable solely to the Service Provider, the Client may give written formal notice to deliver; if delivery has not taken place within ${plural(FORMAL_NOTICE_DAYS, 'day', 'days')} of that notice, the Client may terminate the services and obtain a refund of the sums paid that correspond to services not performed.`,
  ]
}

function revisionsParagraphsEn(t: ResolvedBusiness): string[] {
  const included =
    t.includedRevisions > 0
      ? `${plural(t.includedRevisions, 'revision cycle is', 'revision cycles are')} included per validation phase. A cycle is a single, grouped batch of written change requests, sent all at once after an interim or final delivery (for example, in the first cycle: “change the colour, edit a text, move a section”; in the second: the final corrections). Requests sent separately each count as one cycle.`
      : 'No revision cycle is included in the price: any change requested after a delivery is covered by an amendment.'
  return [
    included,
    'A revision adjusts what already exists (colours, texts, images, position or style of an element). It does not include adding new features, new modules or new structural pages, even if requested after validation: these are invoiced separately.',
    'Any additional change, and any request outside the initial scope (new feature, change to the specifications, redesign of items already validated), is covered by a signed amendment stating its price and its effect on the delivery time; it is carried out only once that amendment has been signed.',
  ]
}

function recetteParagraphsEn(t: ResolvedBusiness): string[] {
  const out = [
    `On delivery, the Client has ${plural(RECETTE_DAYS, 'working day', 'working days')} to sign the acceptance report or to state any reservations in writing, describing them precisely. The Service Provider corrects the defects that fall within the initial scope. If no response is received within that period, the delivery is deemed accepted without reservation.`,
  ]
  out.push(
    t.warrantyDays > 0
      ? `From delivery, the Service Provider provides free correction of defects (bugs) directly related to the development carried out for ${plural(t.warrantyDays, 'day', 'days')}. This warranty does not cover changes made by a third party, hosting or external-service problems, or new features, which are covered by an amendment.`
      : 'No contractual correction warranty is provided after delivery. Any later intervention is covered by an amendment.',
  )
  return out
}

const hostingParagraphEn = () =>
  'Unless otherwise stated, the external services needed to run the solution (domain name, hosting, third-party APIs, email or SMS sending services, cloud storage, etc.) are not included in the price and remain at the Client’s expense; the Client must hold them or give the Service Provider access to them for the duration of the assignment.'

function intellectualPropertyParagraphsEn(t: ResolvedBusiness): string[] {
  const source = t.sourceCodeDelivery
    ? 'The source code of the items specifically developed for the Client (repository or archive), and the files needed for deployment, are handed over to the Client once the price has been paid in full.'
    : 'The source code is not handed over to the Client unless agreed otherwise in writing; the Client nevertheless has the right to use the delivered solution for its intended purpose.'
  return [
    'Until the price has been paid in full, the Service Provider remains the sole holder of all rights in the deliverables; the Client only has a temporary right of use for the purposes of acceptance.',
    'From full payment, the Service Provider assigns to the Client, on an exclusive basis, the economic rights (reproduction, representation, adaptation, modification) in the items specifically developed for the Client, worldwide and for the whole legal term of protection.',
    'The Service Provider keeps ownership of their libraries, reusable components, internal tools and pre-existing know-how; they grant the Client, for the purpose of running the solution, a non-exclusive, worldwide and perpetual licence over those that are built into it. Third-party and open-source components remain subject to their respective licences.',
    source,
  ]
}

const SIGNATURE_PROOF_PARAGRAPH_EN =
  'The Service Provider issues this document as a firm offer and signs it electronically, by affixing their registered signature, when it is issued. The Client accepts it by signing it electronically from the secure link sent to them. The Parties acknowledge that the electronic signature, the timestamp, the IP address, the digital fingerprint (SHA-256) and the event log associated with it have the evidentiary value of a signed writing, and agree not to challenge their admissibility solely on the ground that they are in electronic form. The signatory declares that they have the capacity to contract and, when acting on behalf of a company, the authority to bind it.'

// ── Quote ────────────────────────────────────────────────────────────────────
const DEVIS_FIRST_BLOCK_NUMBER = 5

function devisBlockDefsEn(quote: Quote, t: QuoteTerms, siteUrl: string): DocBlock[] {
  const { expiryStr } = computeQuoteDates(quote)
  const payment = paymentBlockEn(quote, t)
  return [
    {
      title: 'DELIVERABLES',
      paragraphs: ['The services include in particular:'],
      bullets: [
        ...quote.items.map((it) => it.designation),
        'Testing and corrections before final delivery',
        'Support for going live',
        ...(t.sourceCodeDelivery ? ['Handover of the source code after full payment'] : []),
      ],
    },
    {
      title: 'TECHNOLOGIES',
      paragraphs: [
        'The technologies (frontend, backend, database, hosting) are chosen according to the technical needs of the project and may be adjusted in consultation with the Client, with no effect on the agreed price as long as the scope of the services remains unchanged.',
      ],
    },
    { title: 'DELIVERY TIME', paragraphs: deliveryDelayParagraphsEn(t) },
    { title: 'PAYMENT TERMS', paragraphs: ['The price is payable according to the following schedule:'], bullets: payment.bullets },
    { title: 'INVOICING AND LATE-PAYMENT PENALTIES', paragraphs: payment.paragraphs },
    { title: 'HOSTING AND THIRD-PARTY SERVICES', paragraphs: [hostingParagraphEn()] },
    { title: 'REVISIONS AND CHANGES', paragraphs: revisionsParagraphsEn(t) },
    { title: 'ACCEPTANCE AND WARRANTY', paragraphs: recetteParagraphsEn(t) },
    {
      title: 'ITEMS NOT INCLUDED',
      paragraphs: ['Unless otherwise stated, this quote does not include:'],
      bullets: [
        'Features requested after this quote has been validated',
        'Revision cycles beyond those provided for',
        'Subscriptions to third-party services, hosting and the domain name',
        'Creation of content, texts, photographs or videos',
        'Graphic design services not provided for in the initial scope',
        'Work by a third party on the source code',
      ],
    },
    { title: 'INTELLECTUAL PROPERTY AND SOURCE CODE', paragraphs: intellectualPropertyParagraphsEn(t) },
    {
      title: 'GENERAL TERMS AND CONTRACT DOCUMENTS',
      paragraphs: [
        `This quote is subject to the Service Provider’s General Terms of Sale, available at ${siteUrl}/en/cgv. The accepted quote, supplemented by the service contract that follows from it and, where applicable, by the project brief filled in above, constitutes the agreement of the Parties.`,
      ],
    },
    {
      title: 'VALIDITY OF THE QUOTE',
      paragraphs: [
        `This quote is valid for ${plural(quote.validiteJours, 'day', 'days')} from its issue date, that is until ${expiryStr}. After that date, prices and conditions may be revised.`,
      ],
    },
    { title: 'ELECTRONIC SIGNATURE AND EVIDENCE', paragraphs: [SIGNATURE_PROOF_PARAGRAPH_EN] },
  ]
}

function devisBlocksEnV1(quote: Quote, personal: PersonalInfo, siteUrl: string): DocBlock[] {
  return numbered(devisBlockDefsEn(quote, resolveTerms(quote, personal), siteUrl), DEVIS_FIRST_BLOCK_NUMBER, 'section')
}

export const devisAcceptanceLabelEn = (blockCount: number) => `${DEVIS_FIRST_BLOCK_NUMBER + blockCount}. ACCEPTANCE OF THE QUOTE`

// ── Contract ─────────────────────────────────────────────────────────────────

function contractBlocksEnV1(quote: Quote, personal: PersonalInfo, siteUrl: string): DocBlock[] {
  const t = resolveTerms(quote, personal)
  const { dateEmission } = computeQuoteDates(quote)
  const { ville, pays } = parseLocation(t.provider.location)
  const payment = paymentBlockEn(quote, t)

  const defs: DocBlock[] = [
    {
      title: 'PURPOSE OF THE CONTRACT',
      paragraphs: [
        `The purpose of this contract is to set out the terms on which the Service Provider will perform for the Client the software development services described above, in accordance with quote no. ${quote.numero} of ${dateEmission}, accepted by the Client.`,
        'Nature of the services:',
      ],
      bullets: quote.items.map((it) => it.designation),
    },
    {
      title: 'CONTRACT DOCUMENTS AND ORDER OF PRECEDENCE',
      paragraphs: [
        'The following documents constitute the agreement of the Parties. In case of conflict, they prevail in the order in which they are listed:',
      ],
      bullets: [
        'This contract',
        'Any signed amendments',
        `The accepted quote no. ${quote.numero}${quote.brief ? ', including the brief (specifications) it contains' : ''}`,
        `The Service Provider’s General Terms of Sale (${siteUrl}/en/cgv)`,
      ],
    },
    {
      title: 'SCOPE AND REVISIONS',
      paragraphs: [
        'The Service Provider undertakes to perform only the services expressly provided for in the accepted quote.',
        ...revisionsParagraphsEn(t),
      ],
    },
    {
      title: 'DELIVERY TIMES',
      paragraphs: [...deliveryDelayParagraphsEn(t), 'The Client provides, in good time:'],
      bullets: ['Content, texts and images', 'Logos and graphic elements', 'The technical access and information required'],
    },
    {
      title: 'PRICE AND PAYMENT TERMS',
      paragraphs: [
        `The total amount of the services is set at ${fmt(quote.totalTTC)} ${t.vatEnabled ? `incl. tax (${fmt(quote.totalHT)} excl. tax, VAT ${t.vatRate}% included)` : `(${vatMention(t)})`}, payable according to the following schedule:`,
      ],
      bullets: payment.bullets,
    },
    { title: 'INVOICING AND LATE-PAYMENT PENALTIES', paragraphs: payment.paragraphs },
    { title: 'VALIDATION, ACCEPTANCE AND WARRANTY', paragraphs: recetteParagraphsEn(t) },
    { title: 'HOSTING AND THIRD-PARTY SERVICES', paragraphs: [hostingParagraphEn()] },
    { title: 'INTELLECTUAL PROPERTY AND SOURCE CODE', paragraphs: intellectualPropertyParagraphsEn(t) },
    {
      title: 'CONFIDENTIALITY',
      paragraphs: [
        'The Parties undertake to keep strictly confidential the technical, commercial or strategic information exchanged in connection with the project, including after this contract has ended.',
      ],
    },
    {
      title: 'PERSONAL DATA AND SECURITY',
      paragraphs: [
        'The Client remains responsible for the personal data it collects, stores or processes by means of the solution, and for the lawfulness of that processing under the applicable data-protection legislation. The Service Provider acts only on the Client’s documented instructions for the data it accesses in the course of the assignment, does not use it for its own account, does not disclose it to any third party not needed for the assignment, and deletes or returns it at the end of the assignment.',
        'The Service Provider implements reasonable security measures suited to the nature of the project. The Client’s own personal data, collected for the conclusion and performance of the contract, is processed in accordance with the Service Provider’s privacy policy.',
      ],
    },
    {
      title: 'CLIENT’S RESPONSIBILITIES',
      paragraphs: ['The Client undertakes to:'],
      bullets: ['Provide accurate and lawful information and content', 'Meet the validation deadlines', 'Make payments in accordance with the contract', 'Promptly report any defect noticed'],
    },
    {
      title: 'SERVICE PROVIDER’S RESPONSIBILITIES',
      paragraphs: ['The Service Provider undertakes to:'],
      bullets: ['Perform the services in accordance with the accepted quote', 'Follow good development practices', 'Correct the defects for which they are responsible during the warranty'],
    },
    {
      title: 'LIMITATION OF LIABILITY',
      paragraphs: [
        'The Service Provider has an obligation of means. Their liability is limited to direct damage and shall not exceed the amount actually paid by the Client under this contract; they are not liable for indirect damage (loss of business, of customers, of data not backed up by the Client). This limitation does not apply in case of gross negligence or wilful misconduct.',
      ],
    },
    {
      title: 'TERMINATION',
      paragraphs: [
        `In the event of a serious breach by one of the Parties, the other Party may request termination of the contract after a formal notice that has remained without effect for ${plural(FORMAL_NOTICE_DAYS, 'day', 'days')}. If the project is abandoned at the Client’s initiative after work has started, the sums corresponding to the services already performed remain due.`,
      ],
    },
    {
      title: 'PORTFOLIO AND COMMUNICATION',
      paragraphs: [
        'Unless the Client objects in writing, the Service Provider may mention the completed project in their professional portfolio for commercial demonstration purposes, without ever publishing confidential information or the Client’s personal data.',
      ],
    },
    {
      title: 'FORCE MAJEURE',
      paragraphs: [
        'Neither Party may be held liable for a delay or failure to perform resulting from an event beyond its control that meets the conditions of force majeure.',
      ],
    },
    { title: 'ELECTRONIC SIGNATURE AND EVIDENCE', paragraphs: [SIGNATURE_PROOF_PARAGRAPH_EN] },
    {
      title: 'GOVERNING LAW AND DISPUTE RESOLUTION',
      paragraphs: [
        `This contract is governed by the law in force in ${pays}. In the event of a dispute, the Parties undertake to seek an amicable solution first; failing that, the dispute is submitted to the competent courts of ${ville}.`,
      ],
    },
    {
      title: 'ACCEPTANCE OF THE CONTRACT',
      paragraphs: [
        `Signing this contract constitutes full acceptance of its terms and of quote no. ${quote.numero} annexed to it. Done at ${ville}, on ${dateEmission}.`,
      ],
    },
  ]
  return numbered(defs, 1, 'article')
}

// ── Amendment ────────────────────────────────────────────────────────────────

function avenantBlocksEnV1(quote: Quote, personal: PersonalInfo): DocBlock[] {
  const t = resolveTerms(quote, personal)
  const payment = paymentBlockEn(quote, t)
  const parent = quote.parentNumero ?? ''
  const { dateEmission } = computeQuoteDates(quote)
  const { ville } = parseLocation(t.provider.location)
  const extra = quote.extraDelayDays ?? 0

  const defs: DocBlock[] = [
    {
      title: 'PURPOSE OF THE AMENDMENT',
      paragraphs: [
        `This amendment no. ${quote.numero} modifies the service contract linked to quote no. ${parent}, entered into between the same Parties. It covers the following additional services:`,
      ],
      bullets: quote.items.map((it) => it.designation),
    },
    {
      title: 'EFFECT ON THE PRICE',
      paragraphs: [
        `The additional services are invoiced at ${fmt(quote.totalTTC)} ${t.vatEnabled ? `incl. tax (${fmt(quote.totalHT)} excl. tax)` : `(${vatMention(t)})`}, in addition to the price of the initial contract, according to the following schedule:`,
      ],
      bullets: payment.bullets,
    },
    {
      title: 'EFFECT ON THE DELIVERY TIME',
      paragraphs: [
        extra > 0
          ? `The delivery time of the initial contract is extended by ${plural(extra, 'working day', 'working days')}, from receipt of the payment provided for above and of the items needed for the additional services.`
          : 'This amendment has no effect on the delivery time of the initial contract, unless the Parties agree otherwise in writing.',
      ],
    },
    {
      title: 'UNCHANGED CLAUSES',
      paragraphs: [
        `All the other clauses of the initial contract (quote no. ${parent}) remain unchanged and apply to the additional services, in particular the terms of payment, acceptance, warranty and intellectual property.`,
      ],
    },
    { title: 'ELECTRONIC SIGNATURE AND EVIDENCE', paragraphs: [SIGNATURE_PROOF_PARAGRAPH_EN] },
    {
      title: 'ACCEPTANCE OF THE AMENDMENT',
      paragraphs: [`Signing this amendment constitutes acceptance of its terms. Done at ${ville}, on ${dateEmission}.`],
    },
  ]
  return numbered(defs, 1, 'article')
}

// ── Acceptance report ────────────────────────────────────────────────────────

function acceptanceBlocksEnV1(quote: Quote, personal: PersonalInfo): DocBlock[] {
  const t = resolveTerms(quote, personal)
  const delivery = quote.delivery
  const deemedBy = delivery ? date(addBusinessDays(delivery.deliveredAt, RECETTE_DAYS)) : ''
  const warrantyEnd = delivery && t.warrantyDays > 0
    ? date(new Date(new Date(delivery.deliveredAt).getTime() + t.warrantyDays * 86_400_000))
    : ''
  const contractRef = quote.kind === 'avenant' ? `amendment no. ${quote.numero} to the contract linked to quote no. ${quote.parentNumero ?? ''}` : `quote no. ${quote.numero}`

  const defs: DocBlock[] = [
    {
      title: 'PURPOSE',
      paragraphs: [
        `This report records the delivery of the services provided for by ${contractRef}, and the Client’s acceptance of those services.`,
      ],
    },
    {
      title: 'SERVICES DELIVERED',
      paragraphs: [
        delivery ? `Delivery took place on ${date(delivery.deliveredAt)}.` : '',
        ...(delivery?.liveUrl ? [`Access address: ${delivery.liveUrl}`] : []),
        ...(delivery?.note ? [`Service Provider’s remarks: ${delivery.note}`] : []),
      ].filter(Boolean),
      bullets: quote.items.map((it) => `${it.quantite} × ${it.designation}`),
    },
    {
      title: 'CLIENT’S DECLARATION',
      paragraphs: quote.acceptance
        ? [
            quote.acceptance.reserves
              ? 'The Client acknowledges having received the services and grants acceptance WITH RESERVATIONS, described below:'
              : 'The Client acknowledges having received and checked the services and grants acceptance WITHOUT RESERVATION.',
            ...(quote.acceptance.reserves ? [quote.acceptance.reserves] : []),
          ]
        : [
            `The Client has ${plural(RECETTE_DAYS, 'working day', 'working days')} from delivery, that is until ${deemedBy}, to sign this report or to state any reservations in writing. If no response is received, the delivery is deemed accepted without reservation on that date.`,
          ],
    },
    {
      title: 'EFFECTS OF ACCEPTANCE',
      paragraphs: [
        'Acceptance marks the end of the development phase. It makes the balance of the price provided for in the contract due.',
        ...(warrantyEnd
          ? [`The ${plural(t.warrantyDays, 'day', 'days')} defect-correction warranty runs from delivery, that is until ${warrantyEnd}. Any reservations are corrected by the Service Provider within that framework.`]
          : []),
      ],
    },
  ]
  return numbered(defs, 1, 'section')
}

export const EN_BUILDERS_V1 = {
  devis: devisBlocksEnV1,
  contrat: contractBlocksEnV1,
  avenant: avenantBlocksEnV1,
  pv: acceptanceBlocksEnV1,
}
