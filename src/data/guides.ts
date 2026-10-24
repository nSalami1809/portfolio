// The practical guides: plain answers to the questions a client asks before asking for a quote.
// Written here, in the code, on purpose: the texts go through review like any other change, and
// no guide is ever written into the portfolio database. Anything that is a FACT about the owner's
// own business (prices, terms, payment methods) is not written here: it is read from the site's
// real data when the page is drawn (the 'prices', 'terms' and 'payment' blocks), so a guide can
// never contradict a quote. What is said about payment providers stays true whoever the provider
// is: no fee, delay or rule of a particular operator is stated.

export type GuideBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'note'; text: string }
  /** The owner's real offers and their price ranges, from the site's data. */
  | { kind: 'prices' }
  /** The owner's real standard terms (deposit, lead time, revisions, warranty, source code). */
  | { kind: 'terms' }
  /** The owner's real payment offer and the payment methods accepted for quotes. */
  | { kind: 'payment' }

export interface GuideSection {
  id: string
  heading: string
  blocks: GuideBlock[]
}

export interface GuideText {
  title: string
  description: string
  intro: string
  readMinutes: number
  sections: GuideSection[]
  ctaTitle: string
  ctaText: string
}

export interface Guide {
  slug: string
  /** ISO date of the last review of the text. */
  updated: string
  fr: GuideText
  en: GuideText
}

export const GUIDES: Guide[] = [
  {
    slug: 'combien-coute-un-site-web',
    updated: '2026-10-24',
    fr: {
      title: 'Combien coûte un site web au Gabon ?',
      description: 'Ce qui fait varier le prix d’un site, comment lire un devis, et mes fourchettes actuelles.',
      intro: 'Un site très bon marché et un site très cher ne sont pas le même produit. Ce guide explique ce qui fait varier le prix, comment lire un devis sans se tromper, et ce que vous pouvez faire pour garder la facture sous contrôle.',
      readMinutes: 5,
      sections: [
        {
          id: 'pourquoi-pas-de-prix-unique',
          heading: 'Pourquoi il n’existe pas de prix unique',
          blocks: [
            { kind: 'p', text: 'Deux sites qui se ressemblent à l’écran peuvent demander des semaines de travail très différentes derrière. Un site vitrine de trois pages et une boutique avec panier, comptes clients et paiement en ligne n’ont presque rien en commun, ni en travail, ni en responsabilité.' },
            { kind: 'p', text: 'Le bon réflexe n’est donc pas de demander « combien coûte un site ? », mais « combien coûte le site dont j’ai besoin ? ». C’est exactement ce qu’un devis précis répond.' },
          ],
        },
        {
          id: 'ce-qui-fait-varier-le-prix',
          heading: 'Ce qui fait varier le prix',
          blocks: [
            { kind: 'ul', items: [
              'Le nombre de pages et de sections à concevoir.',
              'Les fonctionnalités : formulaire de contact, espace d’administration, comptes utilisateurs, boutique, paiement en ligne.',
              'Les contenus : textes, photos et logo fournis par vous, ou à créer.',
              'Le design : une mise en page adaptée à votre activité, ou une conception entièrement sur mesure.',
              'Le délai : plus il est court, plus le planning est bousculé.',
              'Le suivi après la livraison : hébergement, maintenance, formation à l’outil.',
            ] },
          ],
        },
        {
          id: 'mes-fourchettes',
          heading: 'Mes fourchettes actuelles',
          blocks: [
            { kind: 'p', text: 'Voici mes offres et leurs fourchettes de prix. Elles sont lues sur le site : si je les modifie, cette page change avec elles.' },
            { kind: 'prices' },
            { kind: 'note', text: 'Prix indicatifs : le devis fait foi. Il détaille chaque prestation et son prix.' },
          ],
        },
        {
          id: 'lire-un-devis',
          heading: 'Comment lire un devis',
          blocks: [
            { kind: 'ul', items: [
              'Les prestations sont détaillées, une par une, avec leur quantité et leur prix : pas de ligne « site web » à un prix global.',
              'Le total est clair, avec la mention hors taxes ou toutes taxes comprises.',
              'La durée de validité du devis est indiquée.',
              'Ce qui est inclus (par exemple un nombre de révisions) et ce qui est facturé à part sont écrits.',
              'Le calendrier de paiement et le délai de réalisation figurent dans le document.',
            ] },
            { kind: 'p', text: 'Si un point n’est pas écrit, demandez qu’il le soit avant de signer. Un bon devis protège les deux côtés.' },
          ],
        },
        {
          id: 'mes-conditions',
          heading: 'Mes conditions standard',
          blocks: [
            { kind: 'p', text: 'Ces conditions sont reprises dans chaque devis et chaque contrat. Elles sont lues sur le site, donc toujours identiques à celles de mes documents.' },
            { kind: 'terms' },
            { kind: 'note', text: 'Pour un cas particulier (délai précis, paiement échelonné, autre mode de paiement), on en discute avant le devis.' },
          ],
        },
        {
          id: 'garder-la-facture-sous-controle',
          heading: 'Garder la facture sous contrôle',
          blocks: [
            { kind: 'ul', items: [
              'Commencez par l’essentiel : une première version utile, puis des ajouts quand le besoin est confirmé.',
              'Préparez vos contenus (textes, photos, logo) avant le démarrage : c’est ce qui retarde le plus souvent un projet.',
              'Regroupez vos demandes de modification au lieu de les envoyer une par une.',
              'Choisissez une offre existante quand elle suffit : le sur mesure n’est utile que s’il répond à un vrai besoin.',
              'Décidez vite à chaque étape de validation : un projet qui attend coûte du temps à tout le monde.',
            ] },
          ],
        },
      ],
      ctaTitle: 'Un projet en tête ?',
      ctaText: 'Décrivez-le en quelques lignes : vous recevez un devis détaillé, ou on en parle d’abord de vive voix.',
    },
    en: {
      title: 'How much does a website cost in Gabon?',
      description: 'What makes a website’s price vary, how to read a quote, and my current price ranges.',
      intro: 'A very cheap site and a very expensive one are not the same product. This guide explains what makes the price vary, how to read a quote without being misled, and what you can do to keep the bill under control.',
      readMinutes: 5,
      sections: [
        {
          id: 'why-there-is-no-single-price',
          heading: 'Why there is no single price',
          blocks: [
            { kind: 'p', text: 'Two sites that look alike on screen can hide very different amounts of work. A three-page showcase site and a shop with a cart, customer accounts and online payment have almost nothing in common, in work or in responsibility.' },
            { kind: 'p', text: 'The right question is not “how much does a website cost?” but “how much does the website I need cost?”. That is exactly what a precise quote answers.' },
          ],
        },
        {
          id: 'what-makes-the-price-vary',
          heading: 'What makes the price vary',
          blocks: [
            { kind: 'ul', items: [
              'The number of pages and sections to design.',
              'The features: contact form, admin area, user accounts, shop, online payment.',
              'The content: texts, photos and logo supplied by you, or to be created.',
              'The design: a layout adapted to your activity, or a fully custom design.',
              'The deadline: the shorter it is, the more the schedule is disrupted.',
              'The follow-up after delivery: hosting, maintenance, training on the tool.',
            ] },
          ],
        },
        {
          id: 'my-price-ranges',
          heading: 'My current price ranges',
          blocks: [
            { kind: 'p', text: 'Here are my offers and their price ranges. They are read from the site: if I change them, this page changes with them.' },
            { kind: 'prices' },
            { kind: 'note', text: 'Indicative prices: the quote is what counts. It details each service and its price.' },
          ],
        },
        {
          id: 'reading-a-quote',
          heading: 'How to read a quote',
          blocks: [
            { kind: 'ul', items: [
              'Services are detailed one by one, with quantity and price: no single “website” line at a global price.',
              'The total is clear, stating whether tax is included.',
              'The validity period of the quote is stated.',
              'What is included (for example a number of revision rounds) and what is billed separately are written down.',
              'The payment schedule and the delivery time are in the document.',
            ] },
            { kind: 'p', text: 'If a point is not written, ask for it to be added before signing. A good quote protects both sides.' },
          ],
        },
        {
          id: 'my-terms',
          heading: 'My standard terms',
          blocks: [
            { kind: 'p', text: 'These terms are repeated in every quote and contract. They are read from the site, so they always match my documents.' },
            { kind: 'terms' },
            { kind: 'note', text: 'For a special case (an exact deadline, staged payment, another payment method), we talk about it before the quote.' },
          ],
        },
        {
          id: 'keeping-the-bill-under-control',
          heading: 'Keeping the bill under control',
          blocks: [
            { kind: 'ul', items: [
              'Start with the essentials: a useful first version, then additions once the need is confirmed.',
              'Prepare your content (texts, photos, logo) before the start: it is what most often delays a project.',
              'Group your change requests instead of sending them one by one.',
              'Choose an existing offer when it is enough: custom work is only worth it if it answers a real need.',
              'Decide quickly at each approval step: a project that waits costs everyone time.',
            ] },
          ],
        },
      ],
      ctaTitle: 'A project in mind?',
      ctaText: 'Describe it in a few lines: you receive a detailed quote, or we talk about it first.',
    },
  },
  {
    slug: 'accepter-le-paiement-mobile-money',
    updated: '2026-10-24',
    fr: {
      title: 'Accepter le paiement Mobile Money sur son site : ce qu’il faut savoir',
      description: 'Les trois façons d’encaisser, ce qu’il faut préparer, ce que le site doit bien faire et les questions à poser à un prestataire de paiement.',
      intro: 'Beaucoup de vos clients paient avec leur téléphone. Encaisser sur votre site de la même façon est possible, mais le bon choix dépend de votre volume de ventes et du temps que vous voulez y consacrer. Ce guide pose les bases, sans parti pris pour un opérateur.',
      readMinutes: 5,
      sections: [
        {
          id: 'trois-facons-d-encaisser',
          heading: 'Trois façons d’encaisser',
          blocks: [
            { kind: 'ul', items: [
              'Une page de paiement hébergée par un prestataire : le client est redirigé vers une page sécurisée, paie, puis revient sur votre site. Facile à mettre en place, peu de code, mais vous dépendez de l’apparence et des règles du prestataire.',
              'Une intégration par API : le paiement se lance depuis votre site ou votre application. Vous gardez la main sur le parcours et le suivi des statuts, au prix d’un travail d’intégration plus important.',
              'Un paiement manuel : le client envoie l’argent, puis vous confirmez à la main (message, capture d’écran). Aucune automatisation : acceptable pour démarrer, difficile à suivre dès que les commandes se multiplient.',
            ] },
          ],
        },
        {
          id: 'ce-qu-il-faut-preparer',
          heading: 'Ce qu’il faut préparer',
          blocks: [
            { kind: 'ul', items: [
              'Un compte professionnel ou marchand, chez l’opérateur ou chez un prestataire de paiement.',
              'Les pièces justificatives demandées pour ouvrir ce compte : elles varient selon le prestataire.',
              'Un accès à un environnement de test, pour essayer sans argent réel avant d’ouvrir au public.',
              'Une adresse et un numéro de contact pour le support, au cas où un paiement pose problème.',
            ] },
            { kind: 'note', text: 'Les conditions, les frais et les délais de validation dépendent de l’opérateur ou du prestataire choisi. Demandez-les par écrit avant de vous engager.' },
          ],
        },
        {
          id: 'ce-que-le-site-doit-bien-faire',
          heading: 'Ce que le site doit bien faire',
          blocks: [
            { kind: 'ul', items: [
              'Confirmer le paiement côté serveur auprès du prestataire, et ne jamais se fier à la seule page de retour affichée au client.',
              'Éviter les doubles paiements : un double clic ou une page rechargée ne doit pas débiter deux fois.',
              'Garder une trace de chaque transaction : référence, montant, date, statut.',
              'Gérer l’échec et l’abandon : un message clair, et la possibilité de réessayer sans tout recommencer.',
              'Prévoir un processus de remboursement simple, écrit dans vos conditions de vente.',
            ] },
          ],
        },
        {
          id: 'tester-avant-d-ouvrir',
          heading: 'Tester avant d’ouvrir',
          blocks: [
            { kind: 'p', text: 'Un paiement qui marche une fois ne prouve rien. Testez les cas qui posent problème :' },
            { kind: 'ul', items: [
              'un paiement réussi, de bout en bout ;',
              'un paiement refusé ou annulé par le client ;',
              'un client qui quitte la page en cours de route ;',
              'un double clic et une page rechargée ;',
              'une connexion qui se coupe au mauvais moment.',
            ] },
            { kind: 'p', text: 'Finissez par un vrai paiement d’un petit montant, avant l’ouverture au public.' },
          ],
        },
        {
          id: 'ce-que-je-propose',
          heading: 'Ce que je propose',
          blocks: [
            { kind: 'p', text: 'Voici mon offre d’intégration du paiement et les moyens de paiement que j’accepte pour mes devis. Ils sont lus sur le site.' },
            { kind: 'payment' },
          ],
        },
        {
          id: 'questions-a-poser',
          heading: 'Les questions à poser à un prestataire de paiement',
          blocks: [
            { kind: 'ul', items: [
              'Quels sont les frais, par transaction ou par mois ?',
              'Sous quel délai l’argent est-il reversé sur mon compte ?',
              'Que se passe-t-il en cas de litige ou de paiement non reçu ?',
              'Existe-t-il une documentation technique et un environnement de test ?',
              'Quels moyens de paiement sont couverts, et dans quels pays ?',
              'Comment joindre le support, et dans quels délais répond-il ?',
            ] },
          ],
        },
      ],
      ctaTitle: 'Un paiement à brancher ?',
      ctaText: 'Dites-moi ce que vous vendez et comment vos clients paient aujourd’hui : on regarde la solution la plus simple.',
    },
    en: {
      title: 'Accepting Mobile Money payments on your website: what to know',
      description: 'The three ways to get paid, what to prepare, what the site must do well and the questions to ask a payment provider.',
      intro: 'Many of your customers pay with their phone. Getting paid the same way on your website is possible, but the right choice depends on your sales volume and the time you want to spend on it. This guide lays the basics, with no preference for any operator.',
      readMinutes: 5,
      sections: [
        {
          id: 'three-ways-to-get-paid',
          heading: 'Three ways to get paid',
          blocks: [
            { kind: 'ul', items: [
              'A payment page hosted by a provider: the customer is redirected to a secure page, pays, then returns to your site. Easy to set up, little code, but you depend on the provider’s look and rules.',
              'An API integration: the payment starts from your site or application. You keep control of the journey and of the payment statuses, at the price of more integration work.',
              'A manual payment: the customer sends the money, then you confirm by hand (message, screenshot). No automation: fine to start with, hard to follow once orders multiply.',
            ] },
          ],
        },
        {
          id: 'what-to-prepare',
          heading: 'What to prepare',
          blocks: [
            { kind: 'ul', items: [
              'A business or merchant account, with the operator or with a payment provider.',
              'The supporting documents required to open that account: they vary by provider.',
              'Access to a test environment, to try without real money before opening to the public.',
              'A contact address and number for support, in case a payment goes wrong.',
            ] },
            { kind: 'note', text: 'Conditions, fees and approval times depend on the operator or provider you choose. Ask for them in writing before committing.' },
          ],
        },
        {
          id: 'what-the-site-must-do-well',
          heading: 'What the site must do well',
          blocks: [
            { kind: 'ul', items: [
              'Confirm the payment with the provider on the server side, and never rely only on the return page shown to the customer.',
              'Prevent double payments: a double click or a reloaded page must not charge twice.',
              'Keep a record of every transaction: reference, amount, date, status.',
              'Handle failure and abandonment: a clear message, and the possibility to try again without starting over.',
              'Plan a simple refund process, written in your terms of sale.',
            ] },
          ],
        },
        {
          id: 'test-before-opening',
          heading: 'Test before opening',
          blocks: [
            { kind: 'p', text: 'A payment that works once proves nothing. Test the cases that cause trouble:' },
            { kind: 'ul', items: [
              'a successful payment, end to end;',
              'a payment refused or cancelled by the customer;',
              'a customer who leaves the page halfway;',
              'a double click and a reloaded page;',
              'a connection that drops at the wrong moment.',
            ] },
            { kind: 'p', text: 'Finish with a real payment of a small amount, before opening to the public.' },
          ],
        },
        {
          id: 'what-i-offer',
          heading: 'What I offer',
          blocks: [
            { kind: 'p', text: 'Here is my payment integration offer and the payment methods I accept for my quotes. They are read from the site.' },
            { kind: 'payment' },
          ],
        },
        {
          id: 'questions-to-ask',
          heading: 'Questions to ask a payment provider',
          blocks: [
            { kind: 'ul', items: [
              'What are the fees, per transaction or per month?',
              'How soon is the money paid out to my account?',
              'What happens in case of a dispute or a payment not received?',
              'Is there technical documentation and a test environment?',
              'Which payment methods are covered, and in which countries?',
              'How do I reach support, and how fast does it answer?',
            ] },
          ],
        },
      ],
      ctaTitle: 'A payment to connect?',
      ctaText: 'Tell me what you sell and how your customers pay today: we look at the simplest solution.',
    },
  },
]

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug)
}
