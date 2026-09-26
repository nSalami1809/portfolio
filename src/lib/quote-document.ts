// Legal content for the devis / contrat / avenant / procès-verbal — the shared,
// framework-agnostic source of truth. Both QuoteView (React, on-screen/print)
// and quote-pdf.ts (server-side PDF, email attachment) build their document
// from these same functions, so the two representations can never drift apart.
//
// Every figure and delay printed here comes from the quote's frozen `terms`
// (see lib/business.ts) — never from a literal — so the text always matches
// the amounts and conditions the client actually signed.
import type { Quote } from '@/actions/quotes'
import type { PersonalInfo } from '@/types'
import { frNumber, resolveTerms, splitPayment, type QuoteTerms, type ResolvedBusiness } from '@/lib/business'

export interface DocBlock {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

// toLocaleString('fr-FR') groups thousands with a narrow no-break space
// (U+202F). It renders fine on screen, but pdf-lib's WinAnsi-encoded
// standard fonts (used to print this same amount into the emailed PDF)
// cannot draw that exact character — normalize to a plain space so the
// string is safe in both contexts.
export const fmt = (n: number) => `${n.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} FCFA`

const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
export const formatLongDate = (d: Date | string) => new Date(d).toLocaleDateString('fr-FR', DATE_FORMAT)

export function computeQuoteDates(quote: Quote) {
  const dateEmissionDate = new Date(quote.dateEmission)
  const dateEmission = formatLongDate(dateEmissionDate)
  const expiryDate = new Date(dateEmissionDate)
  expiryDate.setDate(expiryDate.getDate() + quote.validiteJours)
  const expiryStr = formatLongDate(expiryDate)
  return { dateEmissionDate, dateEmission, expiryDate, expiryStr }
}

// Working days (Mon–Fri) — public holidays are deliberately not modelled: the
// documents say "jours ouvrés" and this only produces an indicative date.
export function addBusinessDays(from: Date | string, days: number): Date {
  const d = new Date(from)
  let left = days
  while (left > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return d
}

// "Libreville, Gabon — Disponible en remote" is what the location field
// typically holds: the marketing suffix must never leak into a contract's
// "Fait à …" line or its governing-law clause.
export function parseLocation(location: string): { ville: string; pays: string } {
  const place = (location || '').split(/\s[—–-]\s/)[0].trim() || 'Libreville, Gabon'
  const parts = place.split(',').map((s) => s.trim()).filter(Boolean)
  return { ville: parts[0] || 'Libreville', pays: parts.length > 1 ? parts[parts.length - 1] : 'Gabon' }
}

export const RECETTE_DAYS = 7
const FORMAL_NOTICE_DAYS = 15

export type DocumentVariant = 'devis' | 'contrat'
export type DocumentKind = 'devis' | 'contrat' | 'avenant-proposition' | 'avenant'

export function documentKind(quote: Pick<Quote, 'kind'>, variant: DocumentVariant): DocumentKind {
  if (quote.kind === 'avenant') return variant === 'contrat' ? 'avenant' : 'avenant-proposition'
  return variant
}

export const DOCUMENT_TITLE: Record<DocumentKind, string> = {
  devis: 'DEVIS',
  contrat: 'CONTRAT',
  'avenant-proposition': 'AVENANT',
  avenant: 'AVENANT',
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

export const BRIEF_LABELS = {
  objectifs: 'Objectifs du projet',
  publicCible: 'Public visé',
  fonctionnalites: 'Fonctionnalités attendues',
  contenus: 'Contenus fournis par le Client',
  references: 'Références et inspirations',
  contraintes: 'Contraintes techniques ou réglementaires',
  echeance: 'Échéance souhaitée',
} as const

// The filled-in brief fields, in display order.
export function briefEntries(quote: Pick<Quote, 'brief'>): { label: string; value: string }[] {
  const brief = quote.brief
  if (!brief) return []
  return (Object.keys(BRIEF_LABELS) as (keyof typeof BRIEF_LABELS)[])
    .filter((k) => brief[k]?.trim())
    .map((k) => ({ label: BRIEF_LABELS[k], value: brief[k]!.trim() }))
}

// ── Building blocks shared by the devis and the contract ────────────────────
// One function per clause, used by both documents, so a clause can never be
// worded one way in the devis and another way in the contract (the previous
// version had the two documents pointing at each other for who owns the code).

export function paymentBlock(quote: Pick<Quote, 'totalTTC'>, t: ResolvedBusiness): Pick<DocBlock, 'bullets' | 'paragraphs'> {
  const { acompte, solde } = splitPayment(quote.totalTTC, t.depositPercent)
  const hasDeposit = t.depositPercent > 0 && t.depositPercent < 100
  const bullets = hasDeposit
    ? [
        `Acompte de ${t.depositPercent} % à la signature : ${fmt(acompte)}`,
        `Solde de ${100 - t.depositPercent} % à la livraison finale : ${fmt(solde)}`,
        `Total : ${fmt(quote.totalTTC)} ${t.vatEnabled ? 'TTC' : ''}`.trim(),
      ]
    : [`Paiement intégral à la livraison finale : ${fmt(quote.totalTTC)} ${t.vatEnabled ? 'TTC' : ''}`.trim()]

  const paragraphs = [
    hasDeposit
      ? "Le développement débute après réception de l'acompte."
      : 'Le Prestataire peut subordonner le démarrage du développement à la réception du paiement convenu.',
    hasDeposit
      ? `Une facture est émise pour chaque échéance. La facture d'acompte est payable dès sa réception, le développement débutant après son paiement ; la facture de solde est payable sous ${plural(t.paymentDueDays, 'jour', 'jours')} à compter de son émission. Un reçu est remis à réception de chaque paiement.`
      : `La facture est payable sous ${plural(t.paymentDueDays, 'jour', 'jours')} à compter de son émission ; un reçu est remis à réception du paiement.`,
    `Moyens de paiement acceptés : ${t.paymentMethods}.`,
    `Tout retard de paiement entraîne de plein droit, sans mise en demeure préalable, des pénalités de retard au taux de ${frNumber(t.latePenaltyRate)} % par mois de retard (tout mois commencé étant dû), et autorise le Prestataire à suspendre l'exécution de la prestation jusqu'au règlement complet des sommes exigibles.`,
  ]
  if (hasDeposit) {
    paragraphs.push(
      t.depositRefundable
        ? "En cas d'annulation ou d'abandon du projet à l'initiative du Client, l'acompte est remboursé sous déduction de la valeur des prestations déjà réalisées."
        : "L'acompte est non remboursable en cas d'annulation ou d'abandon du projet à l'initiative du Client ; il reste acquis au Prestataire en contrepartie de la réservation de sa disponibilité et des travaux engagés.",
    )
  }
  if (!t.vatEnabled) paragraphs.push(t.vatExemptionMention)
  return { bullets, paragraphs }
}

export function deliveryDelayParagraphs(t: ResolvedBusiness): string[] {
  return [
    `Le délai de réalisation est estimé à ${plural(t.deliveryDays, 'jour ouvré', 'jours ouvrés')}, en fonction de la taille et de la complexité du projet décrit dans le devis. Il court à compter de la dernière des deux dates suivantes : la réception de l'acompte (ou du premier paiement prévu), et la réception de l'ensemble des contenus, accès et informations nécessaires au projet.`,
    "Ce délai est suspendu pendant les périodes de validation ou de réponse du Client, et prolongé d'autant en cas de retard dans la transmission des éléments à fournir. Il est revu par avenant si le périmètre du projet évolue.",
    `Si le délai est dépassé pour une cause imputable exclusivement au Prestataire, le Client peut le mettre en demeure par écrit de livrer ; à défaut de livraison sous ${plural(FORMAL_NOTICE_DAYS, 'jour', 'jours')} à compter de cette mise en demeure, il peut résilier la prestation et obtenir le remboursement des sommes versées correspondant aux prestations non réalisées.`,
  ]
}

export function revisionsParagraphs(t: ResolvedBusiness): string[] {
  const included =
    t.includedRevisions > 0
      ? `${plural(t.includedRevisions, 'cycle de révision est inclus', 'cycles de révision sont inclus')} par phase de validation. Un cycle est un lot unique et regroupé de demandes de modification écrites, transmis en une fois après une livraison intermédiaire ou finale (par exemple, au premier cycle : « changer la couleur, modifier un texte, déplacer une section » ; au second : les dernières corrections). Des demandes transmises séparément comptent chacune pour un cycle.`
      : "Aucun cycle de révision n'est inclus dans le prix : toute modification demandée après une livraison fait l'objet d'un avenant."
  return [
    included,
    "Une révision ajuste ce qui existe déjà (couleurs, textes, images, position ou style d'un élément). Elle ne comprend pas l'ajout de nouvelles fonctionnalités, de nouveaux modules ou de nouvelles pages structurantes, même demandés après la validation : ceux-ci sont facturés séparément.",
    "Toute modification supplémentaire, ainsi que toute demande sortant du périmètre initial (nouvelle fonctionnalité, changement de cahier des charges, refonte d'éléments déjà validés), fait l'objet d'un avenant signé précisant son prix et son incidence sur le délai ; elle n'est réalisée qu'après signature de cet avenant.",
  ]
}

export function recetteParagraphs(t: ResolvedBusiness): string[] {
  const out = [
    `À la livraison, le Client dispose de ${plural(RECETTE_DAYS, 'jour ouvré', 'jours ouvrés')} pour signer le procès-verbal de recette ou formuler ses réserves par écrit, en les décrivant précisément. Le Prestataire corrige les anomalies relevant du périmètre initial. À défaut de retour dans ce délai, la livraison est réputée acceptée sans réserve.`,
  ]
  out.push(
    t.warrantyDays > 0
      ? `À compter de la livraison, le Prestataire assure pendant ${plural(t.warrantyDays, 'jour', 'jours')} la correction gratuite des anomalies (bugs) liées directement au développement réalisé. Cette garantie ne couvre pas les modifications effectuées par un tiers, les problèmes d'hébergement ou de services externes, ni les nouvelles fonctionnalités, lesquelles relèvent d'un avenant.`
      : "Aucune garantie contractuelle de correction n'est prévue après la livraison. Toute intervention ultérieure fait l'objet d'un avenant.",
  )
  return out
}

export function hostingParagraph(): string {
  return "Sauf mention contraire, les services externes nécessaires à l'exploitation de la solution (nom de domaine, hébergement, API tierces, services d'envoi d'e-mails ou de SMS, stockage cloud, etc.) ne sont pas inclus dans le prix et restent à la charge du Client, qui doit en être titulaire ou en confier l'accès au Prestataire pour la durée de la mission."
}

export function intellectualPropertyParagraphs(t: ResolvedBusiness): string[] {
  const source = t.sourceCodeDelivery
    ? "Le code source des éléments spécifiquement développés pour le Client (dépôt ou archive), ainsi que les fichiers nécessaires au déploiement, lui sont remis après paiement intégral du prix."
    : "Le code source n'est pas remis au Client sauf stipulation contraire écrite ; le Client bénéficie néanmoins du droit d'exploiter la solution livrée conformément à l'usage prévu."
  return [
    "Jusqu'au paiement intégral du prix, le Prestataire demeure seul titulaire de tous les droits sur les livrables ; le Client dispose uniquement d'un droit d'usage provisoire pour les besoins de la recette.",
    "À compter du paiement intégral, le Prestataire cède au Client, à titre exclusif, les droits patrimoniaux (reproduction, représentation, adaptation, modification) sur les éléments spécifiquement développés pour lui, pour le monde entier et pour toute la durée légale de protection.",
    "Le Prestataire conserve la propriété de ses bibliothèques, composants réutilisables, outils internes et savoir-faire préexistants ; il concède au Client, pour les besoins de l'exploitation de la solution, une licence non exclusive, mondiale et perpétuelle sur ceux qui y sont intégrés. Les composants tiers et open source restent soumis à leurs licences respectives.",
    source,
  ]
}

const SIGNATURE_PROOF_PARAGRAPH =
  "Le Prestataire émet le présent document comme offre ferme et le signe électroniquement, par l'apposition de sa signature enregistrée, au moment de son émission. Le Client l'accepte en le signant électroniquement depuis le lien sécurisé qui lui est adressé. Les Parties reconnaissent à la signature électronique, à l'horodatage, à l'adresse IP, à l'empreinte numérique (SHA-256) et au journal d'événements qui y sont associés la valeur probante d'un écrit signé, et conviennent de ne pas en contester la recevabilité au seul motif de sa forme électronique. Le signataire déclare avoir la capacité de contracter et, lorsqu'il agit pour le compte d'une société, avoir le pouvoir de l'engager."

function numbered(blocks: DocBlock[], start: number, style: 'section' | 'article'): DocBlock[] {
  return blocks.map((b, i) => ({
    ...b,
    title: style === 'article' ? `ARTICLE ${start + i} — ${b.title}` : `${start + i}. ${b.title}`,
  }))
}

// ── Devis ────────────────────────────────────────────────────────────────────
// Sections 1–4 (prestataire, client, projet, détail) are rendered directly by
// each consumer; this covers 5 onward. The acceptance block that follows is
// numbered by acceptanceLabel().
export const DEVIS_FIRST_BLOCK_NUMBER = 5

function devisBlockDefs(quote: Quote, t: QuoteTerms, siteUrl: string): DocBlock[] {
  const { expiryStr } = computeQuoteDates(quote)
  const payment = paymentBlock(quote, t)
  return [
    {
      title: 'LIVRABLES',
      paragraphs: ['La prestation comprend notamment :'],
      bullets: [
        ...quote.items.map((it) => it.designation),
        'Tests et corrections avant livraison finale',
        'Accompagnement à la mise en ligne',
        ...(t.sourceCodeDelivery ? ['Remise du code source après paiement intégral'] : []),
      ],
    },
    {
      title: 'TECHNOLOGIES',
      paragraphs: [
        "Les technologies (frontend, backend, base de données, hébergement) sont choisies selon les besoins techniques du projet et peuvent être ajustées en concertation avec le Client, sans incidence sur le prix convenu tant que le périmètre de la prestation reste inchangé.",
      ],
    },
    { title: 'DÉLAI DE RÉALISATION', paragraphs: deliveryDelayParagraphs(t) },
    { title: 'MODALITÉS DE PAIEMENT', paragraphs: ["Le prix est payable selon l'échéancier suivant :"], bullets: payment.bullets },
    { title: 'FACTURATION ET PÉNALITÉS DE RETARD', paragraphs: payment.paragraphs },
    { title: 'HÉBERGEMENT ET SERVICES TIERS', paragraphs: [hostingParagraph()] },
    { title: 'RÉVISIONS ET MODIFICATIONS', paragraphs: revisionsParagraphs(t) },
    { title: 'RECETTE ET GARANTIE', paragraphs: recetteParagraphs(t) },
    {
      title: 'ÉLÉMENTS NON INCLUS',
      paragraphs: ["Sauf mention contraire, le présent devis n'inclut pas :"],
      bullets: [
        'Les fonctionnalités demandées après validation du présent devis',
        "Les cycles de révision au-delà de ceux prévus",
        "Les abonnements à des services tiers, l'hébergement et le nom de domaine",
        'La création de contenus, textes, photographies ou vidéos',
        "Les prestations graphiques non prévues dans le périmètre initial",
        "Les interventions d'un tiers sur le code source",
      ],
    },
    { title: 'PROPRIÉTÉ INTELLECTUELLE ET CODE SOURCE', paragraphs: intellectualPropertyParagraphs(t) },
    {
      title: 'CONDITIONS GÉNÉRALES ET DOCUMENTS CONTRACTUELS',
      paragraphs: [
        `Le présent devis est soumis aux Conditions Générales de Vente du Prestataire, consultables à l'adresse ${siteUrl}/fr/cgv. Le devis accepté, complété par le contrat de prestation qui en découle et, le cas échéant, par le brief du projet renseigné ci-dessus, constitue l'accord des Parties.`,
      ],
    },
    {
      title: 'VALIDITÉ DU DEVIS',
      paragraphs: [
        `Le présent devis est valable ${plural(quote.validiteJours, 'jour', 'jours')} à compter de sa date d'émission, soit jusqu'au ${expiryStr}. Passé ce délai, les prix et conditions peuvent être révisés.`,
      ],
    },
    { title: 'SIGNATURE ÉLECTRONIQUE ET PREUVE', paragraphs: [SIGNATURE_PROOF_PARAGRAPH] },
  ]
}

export function buildDevisBlocks(quote: Quote, personal: PersonalInfo, siteUrl: string): DocBlock[] {
  const t = resolveTerms(quote, personal)
  return numbered(devisBlockDefs(quote, t, siteUrl), DEVIS_FIRST_BLOCK_NUMBER, 'section')
}

export function devisAcceptanceLabel(blockCount: number): string {
  return `${DEVIS_FIRST_BLOCK_NUMBER + blockCount}. ACCEPTATION DU DEVIS`
}

// ── Contrat ──────────────────────────────────────────────────────────────────

export function buildContractBlocks(quote: Quote, personal: PersonalInfo, siteUrl: string): DocBlock[] {
  const t = resolveTerms(quote, personal)
  const { dateEmission } = computeQuoteDates(quote)
  const { ville, pays } = parseLocation(t.provider.location)
  const payment = paymentBlock(quote, t)

  const defs: DocBlock[] = [
    {
      title: 'OBJET DU CONTRAT',
      paragraphs: [
        `Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire réalisera pour le Client la prestation de développement informatique décrite ci-dessus, conformément au devis n° ${quote.numero} du ${dateEmission}, accepté par le Client.`,
        'Nature de la prestation :',
      ],
      bullets: quote.items.map((it) => it.designation),
    },
    {
      title: 'DOCUMENTS CONTRACTUELS ET ORDRE DE PRIORITÉ',
      paragraphs: [
        "Les documents suivants constituent l'accord des Parties. En cas de contradiction, ils prévalent dans l'ordre où ils sont cités :",
      ],
      bullets: [
        'Le présent contrat',
        `Les avenants signés, le cas échéant`,
        `Le devis accepté n° ${quote.numero}${quote.brief ? ', y compris le brief (cahier des charges) qui y figure' : ''}`,
        `Les Conditions Générales de Vente du Prestataire (${siteUrl}/fr/cgv)`,
      ],
    },
    {
      title: 'PÉRIMÈTRE ET RÉVISIONS',
      paragraphs: [
        "Le Prestataire s'engage à réaliser uniquement les prestations expressément prévues dans le devis accepté.",
        ...revisionsParagraphs(t),
      ],
    },
    {
      title: 'DÉLAIS DE RÉALISATION',
      paragraphs: [...deliveryDelayParagraphs(t), 'Le Client fournit dans les délais nécessaires :'],
      bullets: ['Les contenus, textes et images', 'Les logos et éléments graphiques', 'Les accès et informations techniques nécessaires'],
    },
    {
      title: 'PRIX ET MODALITÉS DE PAIEMENT',
      paragraphs: [
        `Le montant total de la prestation est fixé à ${fmt(quote.totalTTC)} ${t.vatEnabled ? `TTC (${fmt(quote.totalHT)} HT, TVA ${frNumber(t.vatRate)} % incluse)` : `(${t.vatExemptionMention})`}, payable selon l'échéancier suivant :`,
      ],
      bullets: payment.bullets,
    },
    {
      title: 'FACTURATION ET PÉNALITÉS DE RETARD',
      paragraphs: payment.paragraphs,
    },
    { title: 'VALIDATION, RECETTE ET GARANTIE', paragraphs: recetteParagraphs(t) },
    { title: 'HÉBERGEMENT ET SERVICES TIERS', paragraphs: [hostingParagraph()] },
    { title: 'PROPRIÉTÉ INTELLECTUELLE ET CODE SOURCE', paragraphs: intellectualPropertyParagraphs(t) },
    {
      title: 'CONFIDENTIALITÉ',
      paragraphs: [
        "Les Parties s'engagent à conserver strictement confidentielles les informations techniques, commerciales ou stratégiques échangées dans le cadre du projet, y compris après la fin du présent contrat.",
      ],
    },
    {
      title: 'DONNÉES PERSONNELLES ET SÉCURITÉ',
      paragraphs: [
        "Le Client demeure responsable des données à caractère personnel qu'il collecte, stocke ou traite au moyen de la solution, ainsi que de la légalité de ces traitements au regard de la législation applicable en matière de protection des données personnelles. Le Prestataire n'agit que sur instruction documentée du Client pour les données auxquelles il accède dans le cadre de la mission, ne les utilise pas pour son propre compte, ne les communique à aucun tiers non nécessaire à la mission et les supprime ou les restitue à l'issue de celle-ci.",
        "Le Prestataire met en œuvre des mesures raisonnables de sécurité adaptées à la nature du projet. Les données personnelles du Client lui-même, collectées pour la conclusion et l'exécution du contrat, sont traitées conformément à la politique de confidentialité du Prestataire.",
      ],
    },
    {
      title: 'RESPONSABILITÉS DU CLIENT',
      paragraphs: ['Le Client s’engage à :'],
      bullets: ['Fournir des informations et contenus exacts et licites', 'Respecter les délais de validation', 'Effectuer les paiements conformément au contrat', 'Signaler rapidement toute anomalie constatée'],
    },
    {
      title: 'RESPONSABILITÉS DU PRESTATAIRE',
      paragraphs: [
        'Le Prestataire s’engage à :',
      ],
      bullets: ['Réaliser la prestation conformément au devis accepté', 'Respecter les bonnes pratiques de développement', 'Corriger les anomalies relevant de sa responsabilité pendant la garantie'],
    },
    {
      title: 'LIMITATION DE RESPONSABILITÉ',
      paragraphs: [
        "Le Prestataire est tenu d'une obligation de moyens. Sa responsabilité est limitée aux dommages directs et ne saurait excéder le montant effectivement payé par le Client au titre du présent contrat ; il ne répond pas des dommages indirects (perte d'exploitation, de clientèle, de données non sauvegardées par le Client). Cette limitation ne s'applique pas en cas de faute lourde ou de dol.",
      ],
    },
    {
      title: 'RÉSILIATION',
      paragraphs: [
        `En cas de manquement grave de l'une des Parties, l'autre Partie peut demander la résiliation du contrat après mise en demeure restée sans effet pendant ${plural(FORMAL_NOTICE_DAYS, 'jour', 'jours')}. En cas d'abandon du projet à l'initiative du Client après le début des travaux, les sommes correspondant aux prestations déjà réalisées restent dues.`,
      ],
    },
    {
      title: 'PORTFOLIO ET COMMUNICATION',
      paragraphs: [
        "Sauf opposition écrite du Client, le Prestataire peut mentionner le projet réalisé dans son portfolio professionnel à des fins de démonstration commerciale, sans jamais publier d'informations confidentielles ou de données personnelles du Client.",
      ],
    },
    {
      title: 'FORCE MAJEURE',
      paragraphs: [
        "Aucune Partie ne peut être tenue responsable d'un retard ou d'une inexécution résultant d'un événement indépendant de sa volonté répondant aux conditions de la force majeure.",
      ],
    },
    { title: 'SIGNATURE ÉLECTRONIQUE ET PREUVE', paragraphs: [SIGNATURE_PROOF_PARAGRAPH] },
    {
      title: 'DROIT APPLICABLE ET RÈGLEMENT DES LITIGES',
      paragraphs: [
        `Le présent contrat est soumis au droit en vigueur au ${pays}. En cas de différend, les Parties s'engagent à rechercher en priorité une solution amiable ; à défaut, le litige est soumis aux juridictions compétentes de ${ville}.`,
      ],
    },
    {
      title: 'ACCEPTATION DU CONTRAT',
      paragraphs: [
        `La signature du présent contrat vaut acceptation pleine et entière de ses conditions ainsi que du devis n° ${quote.numero} qui lui est annexé. Fait à ${ville}, le ${dateEmission}.`,
      ],
    },
  ]
  return numbered(defs, 1, 'article')
}

export const CONTRACT_SIGNATURE_LABEL = 'SIGNATURE DES PARTIES'

// ── Avenant ──────────────────────────────────────────────────────────────────
// A complementary quote that amends an already-signed contract. Deliberately
// short: it only states what changes; everything else stays governed by the
// contract it amends.

export function buildAvenantBlocks(quote: Quote, personal: PersonalInfo): DocBlock[] {
  const t = resolveTerms(quote, personal)
  const payment = paymentBlock(quote, t)
  const parent = quote.parentNumero ?? ''
  const { dateEmission } = computeQuoteDates(quote)
  const { ville } = parseLocation(t.provider.location)
  const extra = quote.extraDelayDays ?? 0

  const defs: DocBlock[] = [
    {
      title: "OBJET DE L'AVENANT",
      paragraphs: [
        `Le présent avenant n° ${quote.numero} modifie le contrat de prestation lié au devis n° ${parent}, conclu entre les mêmes Parties. Il porte sur les prestations complémentaires suivantes :`,
      ],
      bullets: quote.items.map((it) => it.designation),
    },
    {
      title: 'INCIDENCE SUR LE PRIX',
      paragraphs: [
        `Les prestations complémentaires sont facturées ${fmt(quote.totalTTC)} ${t.vatEnabled ? `TTC (${fmt(quote.totalHT)} HT)` : `(${t.vatExemptionMention})`}, en sus du prix du contrat initial, selon l'échéancier suivant :`,
      ],
      bullets: payment.bullets,
    },
    {
      title: 'INCIDENCE SUR LE DÉLAI',
      paragraphs: [
        extra > 0
          ? `Le délai de réalisation du contrat initial est prolongé de ${plural(extra, 'jour ouvré', 'jours ouvrés')}, à compter de la réception du paiement prévu ci-dessus et des éléments nécessaires aux prestations complémentaires.`
          : "Le présent avenant est sans incidence sur le délai de réalisation du contrat initial, sauf accord écrit contraire des Parties.",
      ],
    },
    {
      title: 'CLAUSES INCHANGÉES',
      paragraphs: [
        `Toutes les autres clauses du contrat initial (devis n° ${parent}) demeurent inchangées et s'appliquent aux prestations complémentaires, notamment les conditions de paiement, de recette, de garantie et de propriété intellectuelle.`,
      ],
    },
    { title: 'SIGNATURE ÉLECTRONIQUE ET PREUVE', paragraphs: [SIGNATURE_PROOF_PARAGRAPH] },
    {
      title: "ACCEPTATION DE L'AVENANT",
      paragraphs: [
        `La signature du présent avenant vaut acceptation de ses conditions. Fait à ${ville}, le ${dateEmission}.`,
      ],
    },
  ]
  return numbered(defs, 1, 'article')
}

// ── Procès-verbal de recette ─────────────────────────────────────────────────

export function buildAcceptanceBlocks(quote: Quote, personal: PersonalInfo): DocBlock[] {
  const t = resolveTerms(quote, personal)
  const delivery = quote.delivery
  const deemedBy = delivery ? formatLongDate(addBusinessDays(delivery.deliveredAt, RECETTE_DAYS)) : ''
  const warrantyEnd = delivery && t.warrantyDays > 0
    ? formatLongDate(new Date(new Date(delivery.deliveredAt).getTime() + t.warrantyDays * 86_400_000))
    : ''
  const contractRef = quote.kind === 'avenant' ? `l'avenant n° ${quote.numero} au contrat lié au devis n° ${quote.parentNumero ?? ''}` : `le devis n° ${quote.numero}`

  const defs: DocBlock[] = [
    {
      title: 'OBJET',
      paragraphs: [
        `Le présent procès-verbal constate la livraison des prestations prévues par ${contractRef}, et la recette de ces prestations par le Client.`,
      ],
    },
    {
      title: 'PRESTATIONS LIVRÉES',
      paragraphs: [
        delivery ? `Livraison effectuée le ${formatLongDate(delivery.deliveredAt)}.` : '',
        ...(delivery?.liveUrl ? [`Adresse de mise à disposition : ${delivery.liveUrl}`] : []),
        ...(delivery?.note ? [`Remarques du Prestataire : ${delivery.note}`] : []),
      ].filter(Boolean),
      bullets: quote.items.map((it) => `${it.quantite} × ${it.designation}`),
    },
    {
      title: 'DÉCLARATION DU CLIENT',
      paragraphs: quote.acceptance
        ? [
            quote.acceptance.reserves
              ? `Le Client reconnaît avoir reçu les prestations et prononce la recette AVEC RÉSERVES, décrites ci-après :`
              : 'Le Client reconnaît avoir reçu les prestations, les avoir vérifiées et prononce la recette SANS RÉSERVE.',
            ...(quote.acceptance.reserves ? [quote.acceptance.reserves] : []),
          ]
        : [
            `Le Client dispose de ${plural(RECETTE_DAYS, 'jour ouvré', 'jours ouvrés')} à compter de la livraison, soit jusqu'au ${deemedBy}, pour signer le présent procès-verbal ou formuler ses réserves par écrit. À défaut, la livraison est réputée acceptée sans réserve à cette date.`,
          ],
    },
    {
      title: 'EFFETS DE LA RECETTE',
      paragraphs: [
        'La recette marque la fin de la phase de développement. Elle rend exigible le solde du prix prévu au contrat.',
        ...(warrantyEnd
          ? [`La garantie de correction des anomalies de ${plural(t.warrantyDays, 'jour', 'jours')} court à compter de la livraison, soit jusqu'au ${warrantyEnd}. Les réserves éventuelles sont corrigées par le Prestataire dans ce cadre.`]
          : []),
      ],
    },
  ]
  return numbered(defs, 1, 'section')
}
