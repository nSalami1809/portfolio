// Legal content for the devis/contrat document — shared, framework-agnostic
// source of truth. Both QuoteView (React, on-screen/print) and quote-pdf.ts
// (server-side email attachment) build their document from these same
// functions, so the two representations of a quote can never drift apart.
import type { Quote } from '@/actions/quotes'
import type { PersonalInfo } from '@/types'

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
export const fmt = (n: number) => `${n.toLocaleString('fr-FR').replace(/ /g, ' ')} FCFA`

export function computeQuoteDates(quote: Quote) {
  const dateEmissionDate = new Date(quote.dateEmission)
  const dateEmission = dateEmissionDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  const expiryDate = new Date(dateEmissionDate)
  expiryDate.setDate(expiryDate.getDate() + quote.validiteJours)
  const expiryStr = expiryDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  return { dateEmissionDate, dateEmission, expiryDate, expiryStr }
}

// 14-section devis (numbered exactly as a French informatique services
// quote) — sections 1-4 are the header/parties/table, rendered directly by
// each consumer; this covers 5-13, section 14 being the acceptance block.
export function buildDevisBlocks(quote: Quote): DocBlock[] {
  const { expiryStr } = computeQuoteDates(quote)
  const acompte = Math.round(quote.totalTTC * 0.3)
  const solde = quote.totalTTC - acompte
  const itemDesignations = quote.items.map((it) => it.designation)

  return [
    {
      title: '5. LIVRABLES',
      paragraphs: ['La prestation comprend notamment :'],
      bullets: [
        ...itemDesignations,
        'Tests et corrections avant livraison finale',
        'Accompagnement à la mise en ligne',
      ],
    },
    {
      title: '6. TECHNOLOGIES',
      paragraphs: [
        "Les technologies (frontend, backend, base de données, hébergement) seront choisies selon les besoins techniques du projet et pourront être ajustées en concertation avec le Client, sans incidence sur le prix convenu tant que le périmètre de la prestation reste inchangé.",
      ],
    },
    {
      title: '7. DÉLAI ESTIMATIF',
      paragraphs: [
        "Le délai de réalisation sera fixé d'un commun accord avec le Client à la validation du présent devis, en fonction de la disponibilité des contenus, accès et informations nécessaires au projet. Tout retard dans leur transmission pourra entraîner un report équivalent du calendrier.",
      ],
    },
    {
      title: '8. MODALITÉS DE PAIEMENT',
      bullets: [
        `Acompte de 30 % à la commande : ${fmt(acompte)}`,
        `Solde de 70 % à la livraison finale : ${fmt(solde)}`,
        `Total : ${fmt(quote.totalTTC)} TTC`,
      ],
      paragraphs: ["Le développement débute après réception de l'acompte."],
    },
    {
      title: '9. HÉBERGEMENT ET SERVICES TIERS',
      paragraphs: [
        "Sauf mention contraire, les services externes nécessaires à l'exploitation de la solution (nom de domaine, hébergement, API tierces, services d'envoi d'e-mails ou de SMS, stockage cloud, etc.) ne sont pas inclus dans le présent devis et restent à la charge du Client.",
      ],
    },
    {
      title: '10. MAINTENANCE',
      paragraphs: [
        "Le Prestataire assure, pendant une période de 30 jours après la livraison, la correction gracieuse des anomalies liées directement au développement réalisé. Les évolutions, nouvelles fonctionnalités et modifications de périmètre feront l'objet d'un devis complémentaire.",
      ],
    },
    {
      title: '11. ÉLÉMENTS NON INCLUS',
      paragraphs: ["Sauf mention contraire, le présent devis n'inclut pas :"],
      bullets: [
        'Les fonctionnalités demandées après validation du présent devis',
        "Les abonnements à des services tiers, l'hébergement et le nom de domaine",
        'La création de contenus, textes, photographies ou vidéos',
        "Les prestations graphiques non prévues dans le périmètre initial",
        "Les interventions d'un tiers sur le code source",
      ],
    },
    {
      title: '12. PROPRIÉTÉ INTELLECTUELLE',
      paragraphs: [
        "Après paiement intégral de la prestation, les droits sur les éléments spécifiquement développés pour le Client seront définis conformément au contrat de prestation. Les bibliothèques, frameworks, composants génériques et éléments sous licence tierce restent soumis à leurs licences respectives.",
      ],
    },
    {
      title: '13. VALIDITÉ DU DEVIS',
      paragraphs: [
        `Le présent devis est valable ${quote.validiteJours} jours à compter de sa date d'émission, soit jusqu'au ${expiryStr}. Passé ce délai, les prix et conditions pourront être révisés.`,
      ],
    },
  ]
}

// 19-article contrat de prestation — same underlying quote, framed as a
// binding agreement once the devis has been accepted.
export function buildContractBlocks(quote: Quote, personal: PersonalInfo): DocBlock[] {
  const { dateEmission } = computeQuoteDates(quote)
  const acompte = Math.round(quote.totalTTC * 0.3)
  const solde = quote.totalTTC - acompte
  const itemDesignations = quote.items.map((it) => it.designation)
  const ville = personal.location || 'Libreville'
  const pays = ville.split(',').pop()?.trim() || 'Gabon'

  return [
    {
      title: 'ARTICLE 1 — OBJET DU CONTRAT',
      paragraphs: [
        `Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire réalisera pour le Client la prestation de développement informatique décrite ci-dessus, conformément au devis n° ${quote.numero} du ${dateEmission}, accepté par le Client.`,
        'Nature de la prestation :',
      ],
      bullets: itemDesignations,
    },
    {
      title: 'ARTICLE 2 — DOCUMENTS CONTRACTUELS',
      paragraphs: ['Les documents suivants constituent les éléments contractuels du projet :'],
      bullets: ['Le présent contrat', `Le devis accepté n° ${quote.numero}`, 'Les éventuelles spécifications complémentaires validées par les Parties'],
    },
    {
      title: 'ARTICLE 3 — PÉRIMÈTRE DE LA PRESTATION',
      paragraphs: [
        "Le Prestataire s'engage à réaliser uniquement les prestations expressément prévues dans le devis accepté. Toute fonctionnalité ou prestation supplémentaire demandée après validation pourra faire l'objet d'un devis complémentaire, d'une modification du calendrier et, le cas échéant, d'une facturation additionnelle.",
      ],
    },
    {
      title: 'ARTICLE 4 — DÉLAIS DE RÉALISATION',
      paragraphs: [
        'La prestation débute à réception du premier paiement prévu à l’article 5, sous réserve que le Client fournisse dans les délais nécessaires :',
      ],
      bullets: ['Les contenus, textes et images', 'Les logos et éléments graphiques', 'Les accès et informations techniques nécessaires'],
    },
    {
      title: 'ARTICLE 5 — PRIX ET MODALITÉS DE PAIEMENT',
      paragraphs: [`Le montant total de la prestation est fixé à ${fmt(quote.totalTTC)} TTC (${fmt(quote.totalHT)} HT, TVA 18 % incluse), payable selon l'échéancier suivant :`],
      bullets: [`Acompte de 30 % à la signature du contrat : ${fmt(acompte)}`, `Solde de 70 % à la livraison finale : ${fmt(solde)}`],
    },
    {
      title: 'ARTICLE 6 — VALIDATION ET RECETTE',
      paragraphs: [
        "À la fin du développement, le Prestataire met la solution à disposition du Client pour validation. Le Client dispose d'un délai de 7 jours ouvrés pour signaler toute anomalie relevant du périmètre initial. À défaut de retour dans ce délai, la livraison est considérée comme acceptée.",
      ],
    },
    {
      title: 'ARTICLE 7 — MAINTENANCE ET GARANTIE',
      paragraphs: [
        "Le Prestataire assure, pendant 30 jours après la livraison, la correction des anomalies liées directement au développement réalisé. Cette garantie ne couvre pas les modifications effectuées par un tiers, les problèmes d'hébergement ou de services externes, ni les nouvelles fonctionnalités.",
      ],
    },
    {
      title: 'ARTICLE 8 — HÉBERGEMENT ET SERVICES TIERS',
      paragraphs: [
        'Sauf accord contraire, le Client reste responsable du paiement des services tiers nécessaires à l’exploitation de la solution : hébergement, nom de domaine, API, services de paiement, stockage cloud et autres abonnements.',
      ],
    },
    {
      title: 'ARTICLE 9 — PROPRIÉTÉ INTELLECTUELLE',
      paragraphs: [
        'Après paiement intégral du prix convenu, le Client bénéficie des droits prévus au devis sur les éléments spécifiquement développés pour son projet. Le Prestataire conserve la propriété de ses bibliothèques, composants réutilisables, outils internes et savoir-faire.',
      ],
    },
    {
      title: 'ARTICLE 10 — CODE SOURCE',
      paragraphs: [
        "Après règlement intégral de la prestation, le Prestataire remet au Client, lorsque cela est prévu au devis, le code source, les fichiers nécessaires au déploiement et les accès appartenant au Client.",
      ],
    },
    {
      title: 'ARTICLE 11 — CONFIDENTIALITÉ',
      paragraphs: [
        "Les Parties s'engagent à conserver strictement confidentielles les informations techniques, commerciales ou stratégiques échangées dans le cadre du projet, y compris après la fin du présent contrat.",
      ],
    },
    {
      title: 'ARTICLE 12 — DONNÉES ET SÉCURITÉ',
      paragraphs: [
        "Le Prestataire met en œuvre des mesures raisonnables de sécurité adaptées à la nature du projet. Le Client demeure responsable de la légalité des données qu'il collecte, stocke ou traite avec la solution.",
      ],
    },
    {
      title: 'ARTICLE 13 — RESPONSABILITÉS DU CLIENT',
      paragraphs: ['Le Client s’engage à :'],
      bullets: ['Fournir des informations et contenus exacts', 'Respecter les délais de validation', 'Effectuer les paiements conformément au contrat', 'Signaler rapidement toute anomalie constatée'],
    },
    {
      title: 'ARTICLE 14 — RESPONSABILITÉS DU PRESTATAIRE',
      paragraphs: ['Le Prestataire s’engage à :'],
      bullets: ['Réaliser la prestation conformément au devis accepté', 'Respecter les bonnes pratiques de développement', 'Corriger les anomalies relevant de sa responsabilité pendant la garantie'],
    },
    {
      title: 'ARTICLE 15 — RÉSILIATION',
      paragraphs: [
        "En cas de manquement grave de l'une des Parties, l'autre Partie pourra demander la résiliation du contrat après mise en demeure restée sans effet pendant 15 jours. En cas d'abandon du projet à l'initiative du Client après le début des travaux, les sommes correspondant aux prestations déjà réalisées restent dues.",
      ],
    },
    {
      title: 'ARTICLE 16 — PORTFOLIO ET COMMUNICATION',
      paragraphs: [
        "Sauf opposition écrite du Client, le Prestataire pourra mentionner le projet réalisé dans son portfolio professionnel à des fins de démonstration commerciale, sans jamais publier d'informations confidentielles ou de données personnelles du Client.",
      ],
    },
    {
      title: 'ARTICLE 17 — FORCE MAJEURE',
      paragraphs: [
        "Aucune Partie ne pourra être tenue responsable d'un retard ou d'une inexécution résultant d'un événement indépendant de sa volonté répondant aux conditions de la force majeure.",
      ],
    },
    {
      title: 'ARTICLE 18 — DROIT APPLICABLE ET RÈGLEMENT DES LITIGES',
      paragraphs: [
        `Le présent contrat est soumis au droit en vigueur au ${pays}. En cas de différend, les Parties s'engagent à rechercher en priorité une solution amiable ; à défaut, le litige sera soumis aux juridictions compétentes.`,
      ],
    },
    {
      title: 'ARTICLE 19 — ACCEPTATION DU CONTRAT',
      paragraphs: [
        `La signature du présent contrat vaut acceptation pleine et entière de ses conditions ainsi que du devis n° ${quote.numero} qui lui est annexé. Fait à ${ville}, le ${dateEmission}.`,
      ],
    },
  ]
}
