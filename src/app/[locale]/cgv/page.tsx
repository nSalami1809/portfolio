import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { frNumber, identityLines, resolveBusiness, type ResolvedBusiness } from '@/lib/business'
import {
  deliveryDelayParagraphs, hostingParagraph, intellectualPropertyParagraphs, parseLocation, recetteParagraphs, revisionsParagraphs,
  RECETTE_DAYS,
} from '@/lib/quote-document'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const isEn = (isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE) === 'en'
  return { title: isEn ? 'Terms of sale' : 'Conditions générales de vente' }
}

interface Section { h: string; b: string[] }

// The general terms are generated from the same settings — and the same
// clause wording — as the devis and the contract (lib/quote-document.ts), so
// the three documents cannot contradict each other. The contract states the
// order of precedence: contract, then signed amendments, then the quote, then
// these terms.
function sectionsFr(name: string, b: ResolvedBusiness): Section[] {
  const hasDeposit = b.depositPercent > 0 && b.depositPercent < 100
  return [
    {
      h: '1. Objet et champ d’application',
      b: [
        `Les présentes conditions générales de vente régissent les prestations de développement informatique (sites et applications web, intégrations, déploiement) fournies par ${name} (le « Prestataire ») à tout client professionnel ou particulier (le « Client »). Elles s’appliquent à tout devis, contrat et avenant, sauf stipulation contraire écrite et signée.`,
      ],
    },
    {
      h: '2. Devis, commande et signature électronique',
      b: [
        'Le devis est une offre ferme valable pendant la durée qu’il indique. La commande est formée lorsque le Client signe électroniquement le devis depuis le lien sécurisé qui lui est transmis ; elle est alors confirmée par un contrat de prestation. Les Parties reconnaissent à la signature électronique, à l’horodatage, à l’adresse IP, à l’empreinte numérique (SHA-256) et au journal d’événements associés la valeur probante d’un écrit signé.',
        'Le signataire déclare avoir la capacité de contracter et, s’il agit pour une société, le pouvoir de l’engager.',
      ],
    },
    {
      h: '3. Prix et paiement',
      b: [
        `Les prix sont exprimés en francs CFA (FCFA). ${b.vatEnabled ? `Ils sont indiqués hors taxes puis toutes taxes comprises, la TVA applicable étant de ${frNumber(b.vatRate)} %.` : b.vatExemptionMention + '.'}`,
        hasDeposit
          ? `Un acompte de ${b.depositPercent} % est dû à la signature, le solde à la livraison finale. ${b.depositRefundable ? 'L’acompte est remboursable sous déduction de la valeur des prestations déjà réalisées.' : 'L’acompte est non remboursable en cas d’annulation à l’initiative du Client.'}`
          : 'Le prix est payable intégralement à la livraison finale.',
        `Une facture est émise pour chaque échéance. ${hasDeposit ? `La facture d’acompte est payable dès sa réception (le développement débute après son paiement) ; la facture de solde est payable` : 'La facture est payable'} sous ${b.paymentDueDays} jour${b.paymentDueDays > 1 ? 's' : ''} à compter de son émission. Moyens de paiement acceptés : ${b.paymentMethods}.`,
        `Tout retard de paiement entraîne de plein droit, sans mise en demeure préalable, des pénalités de retard de ${frNumber(b.latePenaltyRate)} % par mois de retard (tout mois commencé étant dû), et autorise le Prestataire à suspendre la prestation.`,
      ],
    },
    { h: '4. Délais', b: deliveryDelayParagraphs(b) },
    { h: '5. Périmètre, révisions et modifications', b: revisionsParagraphs(b) },
    {
      h: '6. Obligations du Client',
      b: ['Le Client fournit des informations, contenus et accès exacts et licites, dans les délais nécessaires ; respecte les délais de validation ; règle les sommes dues à leur échéance ; et signale sans délai toute anomalie. Il garantit détenir les droits sur les contenus qu’il fournit.'],
    },
    { h: '7. Livraison, recette et garantie', b: recetteParagraphs(b) },
    { h: '8. Hébergement et services tiers', b: [hostingParagraph()] },
    { h: '9. Propriété intellectuelle et code source', b: intellectualPropertyParagraphs(b) },
    {
      h: '10. Confidentialité',
      b: ['Les Parties conservent strictement confidentielles les informations techniques, commerciales ou stratégiques échangées dans le cadre du projet, y compris après son terme.'],
    },
    {
      h: '11. Données personnelles',
      b: ['Le Client reste responsable des données personnelles qu’il traite au moyen de la solution livrée et de la légalité de ces traitements. Pour les données auxquelles il accède pendant la mission, le Prestataire n’agit que sur instruction du Client, ne les utilise pas pour son propre compte, ne les communique à aucun tiers non nécessaire à la mission et les supprime ou les restitue à son terme. Le traitement des données du Client lui-même est décrit dans la politique de confidentialité du site.'],
    },
    {
      h: '12. Responsabilité',
      b: ['Le Prestataire est tenu d’une obligation de moyens. Sa responsabilité est limitée aux dommages directs et ne peut excéder le montant effectivement payé par le Client au titre de la prestation concernée ; il ne répond pas des dommages indirects (perte d’exploitation, de clientèle ou de données non sauvegardées). Cette limitation ne s’applique pas en cas de faute lourde ou de dol.'],
    },
    {
      h: '13. Résiliation et force majeure',
      b: [
        'En cas de manquement grave de l’une des Parties, l’autre peut résilier la prestation après mise en demeure écrite restée sans effet pendant 15 jours. Les sommes correspondant aux prestations déjà réalisées restent dues.',
        'Aucune Partie n’est responsable d’un retard ou d’une inexécution résultant d’un cas de force majeure.',
      ],
    },
    {
      h: '14. Droit applicable et litiges',
      b: ['Les présentes conditions sont soumises au droit applicable au lieu d’établissement du Prestataire. Les Parties recherchent en priorité une solution amiable ; à défaut, le litige est porté devant les juridictions compétentes.'],
    },
  ]
}

function sectionsEn(name: string, b: ResolvedBusiness): Section[] {
  const hasDeposit = b.depositPercent > 0 && b.depositPercent < 100
  return [
    {
      h: '1. Purpose and scope',
      b: [`These terms of sale govern the software development services (websites, web applications, integrations, deployment) provided by ${name} (the “Provider”) to any business or individual client (the “Client”). They apply to every quote, contract and amendment unless a signed written agreement says otherwise. The contract documents are drafted in French; the French version prevails in case of discrepancy.`],
    },
    {
      h: '2. Quotes, orders and electronic signature',
      b: [
        'A quote is a firm offer valid for the period it states. The order is formed when the Client electronically signs the quote from the secure link sent to them, and is then confirmed by a service contract. The parties agree that the electronic signature, timestamp, IP address, SHA-256 fingerprint and audit log attached to it have the evidential value of a signed writing.',
        'The signatory declares having the capacity to contract and, when acting for a company, the authority to bind it.',
      ],
    },
    {
      h: '3. Price and payment',
      b: [
        `Prices are in CFA francs (FCFA). ${b.vatEnabled ? `They are shown excluding tax and then including tax, the applicable VAT being ${b.vatRate}%.` : 'VAT is not applicable.'}`,
        hasDeposit
          ? `A ${b.depositPercent}% deposit is due at signature and the balance on final delivery. ${b.depositRefundable ? 'The deposit is refundable minus the value of work already carried out.' : 'The deposit is non-refundable if the Client cancels.'}`
          : 'The price is payable in full on final delivery.',
        `An invoice is issued for each instalment. ${hasDeposit ? 'The deposit invoice is payable on receipt (work starts once it is paid); the balance invoice is payable' : 'The invoice is payable'} within ${b.paymentDueDays} day${b.paymentDueDays === 1 ? '' : 's'} of issue. Accepted payment methods: ${b.paymentMethods}.`,
        `Late payment automatically incurs late-payment interest of ${b.latePenaltyRate}% per month of delay (any started month is due), without prior notice, and entitles the Provider to suspend the work.`,
      ],
    },
    {
      h: '4. Lead time',
      b: [
        `The lead time is estimated at ${b.deliveryDays} working days, depending on the size and complexity of the project described in the quote, starting on the later of receipt of the deposit (or first payment) and receipt of all content, access and information needed. It is suspended while the Client's validation or answers are pending. If the deadline is exceeded for a reason solely attributable to the Provider, the Client may give written notice; failing delivery within 15 days of that notice, the Client may terminate and be refunded the sums paid for undelivered work.`,
      ],
    },
    {
      h: '5. Scope, revisions and changes',
      b: [
        b.includedRevisions > 0
          ? `${b.includedRevisions} revision round${b.includedRevisions > 1 ? 's are' : ' is'} included per validation phase. A round is a single, consolidated batch of written change requests sent at once after a delivery (e.g. round 1: “change the colour, edit a text, move a section”; round 2: the last corrections). Requests sent separately each count as a round.`
          : 'No revision round is included in the price; any change requested after delivery requires an amendment.',
        'A revision adjusts what already exists (colours, texts, images, position or style of an element). It does not include adding new features, modules or structural pages, even when requested after validation: these are billed separately.',
        'Any additional change or out-of-scope request requires a signed amendment stating its price and effect on the lead time, and is carried out only once signed.',
      ],
    },
    {
      h: '6. Client obligations',
      b: ['The Client provides accurate and lawful information, content and access within the necessary time, meets validation deadlines, pays sums when due and reports any defect promptly. The Client warrants holding the rights to the content they supply.'],
    },
    {
      h: '7. Delivery, acceptance and warranty',
      b: [
        `After delivery the Client has ${RECETTE_DAYS} working days to sign the acceptance report or state written reservations. Failing a reply, delivery is deemed accepted without reservation.`,
        b.warrantyDays > 0
          ? `For ${b.warrantyDays} days from delivery the Provider fixes bugs directly related to the work delivered, free of charge. The warranty excludes third-party modifications, hosting or external-service problems and new features.`
          : 'No contractual post-delivery warranty applies; later work requires an amendment.',
      ],
    },
    {
      h: '8. Hosting and third-party services',
      b: ['Unless stated otherwise, external services needed to run the solution (domain name, hosting, third-party APIs, e-mail/SMS services, cloud storage) are not included in the price and remain the Client’s responsibility.'],
    },
    {
      h: '9. Intellectual property and source code',
      b: [
        'Until full payment the Provider remains sole owner of all rights in the deliverables; the Client only has a provisional right of use for acceptance purposes. Upon full payment the Provider assigns to the Client, exclusively, the economic rights in the elements specifically developed for them, worldwide and for the full legal term.',
        'The Provider keeps its pre-existing libraries, reusable components, internal tools and know-how, and grants the Client a non-exclusive, worldwide, perpetual licence to use those integrated into the solution. Third-party and open-source components remain under their own licences.',
        b.sourceCodeDelivery ? 'The source code of the specifically developed elements is handed over after full payment.' : 'The source code is not handed over unless agreed in writing; the Client may nevertheless operate the delivered solution for its intended use.',
      ],
    },
    {
      h: '10. Confidentiality and personal data',
      b: [
        'Both parties keep confidential the technical, commercial and strategic information exchanged, including after the project ends.',
        'The Client remains responsible for personal data processed through the delivered solution. For data it accesses during the mission the Provider acts only on the Client’s instructions, does not use it for its own purposes, does not disclose it to unnecessary third parties and deletes or returns it at the end. The handling of the Client’s own data is described in the site’s privacy policy.',
      ],
    },
    {
      h: '11. Liability, termination and governing law',
      b: [
        'The Provider owes an obligation of means. Liability is limited to direct damage and capped at the amount actually paid for the service concerned; indirect damage is excluded. This does not apply to gross negligence or wilful misconduct.',
        'Either party may terminate for serious breach after written notice left unanswered for 15 days; sums for work already done remain due. Neither party is liable for force majeure.',
        'These terms are governed by the law applicable where the Provider is established. The parties will first seek an amicable solution, failing which the competent courts have jurisdiction.',
      ],
    },
  ]
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const portfolio = await fetchPortfolioSafe('cgv/page')
  const personal = portfolio?.personal ?? defaultPersonalInfo
  const b = resolveBusiness(personal)
  const isEn = locale === 'en'

  const sections = isEn ? sectionsEn(personal.name, b) : sectionsFr(personal.name, b)
  const identity = identityLines(b)
  const { ville, pays } = parseLocation(personal.location)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>
        {isEn ? 'Terms of sale' : 'Conditions générales de vente'}
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--text-subtle)' }}>
        {personal.name}
        {identity.length ? ` — ${identity.join(' · ')}` : ''}
        {` — ${b.address || `${ville}, ${pays}`} — ${personal.email}`}
      </p>
      <div className="space-y-8">
        {sections.map((s) => (
          <div key={s.h}>
            <h2 className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>{s.h}</h2>
            <div className="space-y-2">
              {s.b.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{p}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
