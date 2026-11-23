// The guides written for what clients and recruiters type in a search engine: a website, an app, a chatbot, a developer in
// Libreville or in Gabon. Same rules as guides.ts: no price, delay or percentage written here (the 'prices' and 'terms' blocks
// read the site's own data), and the French and English versions have the same shape.
import type { Guide } from '@/data/guides'

export const LOCAL_GUIDES: Guide[] = [
  {
    slug: 'creation-site-web-libreville',
    updated: '2026-11-23',
    fr: {
      title: 'Création de site web à Libreville : vitrine, boutique en ligne, application',
      description: 'Faire créer un site web à Libreville ou au Gabon : quel type de site choisir, comment se déroule le projet, devis en ligne et suivi.',
      intro: 'Vous cherchez à faire créer un site web à Libreville, ou ailleurs au Gabon ? Ce guide explique les types de sites possibles, ce qu’il faut préparer avant de commencer et comment se déroule un projet, du devis à la livraison.',
      readMinutes: 5,
      sections: [
        {
          id: 'quel-type-de-site',
          heading: 'Quel type de site choisir',
          blocks: [
            { kind: 'p', text: 'Le bon site dépend de ce que vous voulez en faire, pas de la mode du moment. Voici les trois grandes familles.' },
            { kind: 'ul', items: [
              'Le site vitrine : présenter votre activité, vos services, vos réalisations et un moyen de vous contacter.',
              'La boutique en ligne (e-commerce) : un catalogue, un panier, la gestion des commandes et le paiement en ligne.',
              'L’application web sur mesure : un outil métier avec comptes utilisateurs, tableau de bord et règles propres à votre activité.',
            ] },
          ],
        },
        {
          id: 'ce-que-vous-obtenez',
          heading: 'Ce que vous obtenez',
          blocks: [
            { kind: 'ul', items: [
              'Un site qui s’affiche correctement sur téléphone, tablette et ordinateur.',
              'Un site rapide et référencé : titres, descriptions et structure pensés pour les moteurs de recherche.',
              'Si besoin, un espace d’administration pour modifier vous-même vos textes, vos images et vos produits.',
              'Le code source livré, selon les conditions du devis.',
            ] },
          ],
        },
        {
          id: 'deroulement-du-projet',
          heading: 'Comment se déroule le projet',
          blocks: [
            { kind: 'p', text: 'Tout se fait en ligne, sans déplacement, avec des étapes claires :' },
            { kind: 'ul', items: [
              'Vous décrivez votre besoin et obtenez un devis instantané sur le site.',
              'Vous signez le devis en ligne, ce qui donne lieu à un contrat.',
              'Le développement avance par étapes que vous validez.',
              'À la livraison, un procès-verbal de recette est signé, puis la facture et le reçu vous sont remis.',
            ] },
          ],
        },
        {
          id: 'tarifs-et-conditions',
          heading: 'Tarifs et conditions',
          blocks: [
            { kind: 'p', text: 'Les prix de départ ci-dessous sont ceux du site à l’instant où vous lisez cette page. Le prix final figure toujours dans votre devis.' },
            { kind: 'prices' },
            { kind: 'terms' },
          ],
        },
        {
          id: 'preparer-votre-demande',
          heading: 'Préparer votre demande',
          blocks: [
            { kind: 'ul', items: [
              'Ce que vous vendez ou proposez, et à qui.',
              'Trois sites que vous aimez, pour comprendre vos goûts.',
              'Votre logo, vos textes et vos photos, si vous les avez déjà.',
              'Les fonctions indispensables : contact, paiement, réservation, espace client.',
            ] },
            { kind: 'p', text: 'Plus la demande est précise, plus le devis l’est aussi.' },
          ],
        },
      ],
      ctaTitle: 'Un site à créer à Libreville ?',
      ctaText: 'Décrivez votre projet : vous obtenez un devis instantané, sans engagement.',
    },
    en: {
      title: 'Website development in Libreville: showcase site, online shop, web app',
      description: 'Getting a website built in Libreville or anywhere in Gabon: which type of site to choose, how the project runs, online quote and follow-up.',
      intro: 'Looking to have a website built in Libreville, or elsewhere in Gabon? This guide explains the types of site, what to prepare before starting and how a project runs, from quote to delivery.',
      readMinutes: 5,
      sections: [
        {
          id: 'which-type-of-site',
          heading: 'Which type of site to choose',
          blocks: [
            { kind: 'p', text: 'The right site depends on what you want it to do, not on fashion. These are the three main families.' },
            { kind: 'ul', items: [
              'The showcase site: present your activity, your services, your work and a way to contact you.',
              'The online shop (e-commerce): a catalogue, a basket, order management and online payment.',
              'The custom web application: a business tool with user accounts, a dashboard and rules specific to your activity.',
            ] },
          ],
        },
        {
          id: 'what-you-get',
          heading: 'What you get',
          blocks: [
            { kind: 'ul', items: [
              'A site that displays properly on phone, tablet and computer.',
              'A fast, searchable site: titles, descriptions and structure built for search engines.',
              'If needed, an admin area to edit your texts, images and products yourself.',
              'The source code, delivered according to the quote’s terms.',
            ] },
          ],
        },
        {
          id: 'how-the-project-runs',
          heading: 'How the project runs',
          blocks: [
            { kind: 'p', text: 'Everything happens online, with no travel, in clear steps:' },
            { kind: 'ul', items: [
              'You describe your need and get an instant quote on the site.',
              'You sign the quote online, which gives rise to a contract.',
              'Development moves forward in steps that you validate.',
              'On delivery, an acceptance report is signed, then the invoice and the receipt are handed over.',
            ] },
          ],
        },
        {
          id: 'prices-and-terms',
          heading: 'Prices and terms',
          blocks: [
            { kind: 'p', text: 'The starting prices below are the ones on the site right now. The final price is always in your quote.' },
            { kind: 'prices' },
            { kind: 'terms' },
          ],
        },
        {
          id: 'prepare-your-request',
          heading: 'Preparing your request',
          blocks: [
            { kind: 'ul', items: [
              'What you sell or offer, and to whom.',
              'Three sites you like, to understand your taste.',
              'Your logo, texts and photos, if you already have them.',
              'The essential functions: contact, payment, booking, customer area.',
            ] },
            { kind: 'p', text: 'The more precise the request, the more precise the quote.' },
          ],
        },
      ],
      ctaTitle: 'A website to build in Libreville?',
      ctaText: 'Describe your project: you get an instant quote, with no commitment.',
    },
  },
  {
    slug: 'developpeur-fullstack-devops-gabon',
    updated: '2026-11-23',
    fr: {
      title: 'Développeur fullstack et DevOps freelance au Gabon : ce que je fais pour vous',
      description: 'Développeur web fullstack et DevOps freelance à Libreville : technologies maîtrisées, types de missions, façon de travailler et disponibilité.',
      intro: 'Je suis développeur fullstack et DevOps, basé à Libreville et disponible pour des missions au Gabon comme à distance. Ce guide présente ce que je réalise, avec quelles technologies, et comment nous travaillons ensemble.',
      readMinutes: 4,
      sections: [
        {
          id: 'profil',
          heading: 'Un profil complet, du design à la mise en ligne',
          blocks: [
            { kind: 'p', text: 'Un développeur fullstack s’occupe de l’interface que l’utilisateur voit, de la logique côté serveur et de la base de données. Le volet DevOps ajoute le déploiement, l’automatisation et la surveillance : votre application est mise en ligne proprement et reste disponible.' },
          ],
        },
        {
          id: 'technologies',
          heading: 'Technologies maîtrisées',
          blocks: [
            { kind: 'ul', items: [
              'Frontend : React, Next.js, TypeScript, JavaScript, Tailwind CSS, Angular, HTML et CSS.',
              'Backend : Node.js, Express, PHP et Laravel, Python, API REST et GraphQL.',
              'Bases de données : PostgreSQL, MySQL, MongoDB, Redis.',
              'Mobile : Flutter et Kotlin.',
              'DevOps : Docker, Kubernetes, GitHub Actions, Terraform, AWS, Vercel, Linux, Nginx.',
              'Suivi et qualité : Git, Prometheus, Grafana, Postman.',
            ] },
          ],
        },
        {
          id: 'types-de-missions',
          heading: 'Types de missions',
          blocks: [
            { kind: 'ul', items: [
              'Création de sites vitrines, de boutiques en ligne et d’applications web sur mesure.',
              'Développement d’API et de services serveur.',
              'Mise en place de la livraison continue : tests, build et déploiement automatiques.',
              'Reprise, correction ou amélioration d’une application existante.',
              'Intégration d’intelligence artificielle dans un produit ou un processus.',
            ] },
          ],
        },
        {
          id: 'facon-de-travailler',
          heading: 'Ma façon de travailler',
          blocks: [
            { kind: 'p', text: 'Chaque projet commence par un devis écrit et signé en ligne. Vous validez le travail par étapes, vous suivez l’avancement de votre dossier en ligne et la livraison se termine par un procès-verbal de recette. Les conditions précises figurent dans le devis.' },
            { kind: 'terms' },
          ],
        },
        {
          id: 'disponibilite-et-contact',
          heading: 'Disponibilité et contact',
          blocks: [
            { kind: 'p', text: 'Je travaille depuis Libreville, avec des clients au Gabon et à distance. Vous pouvez réserver un échange en ligne, demander un devis instantané ou me contacter directement par le formulaire.' },
          ],
        },
      ],
      ctaTitle: 'Une mission à confier ?',
      ctaText: 'Décrivez votre besoin : je vous réponds avec un devis clair et un planning.',
    },
    en: {
      title: 'Freelance fullstack and DevOps developer in Gabon: what I do for you',
      description: 'Freelance fullstack and DevOps web developer in Libreville: technologies I use, types of assignment, way of working and availability.',
      intro: 'I am a fullstack and DevOps developer based in Libreville, available for assignments in Gabon and remotely. This guide shows what I build, with which technologies, and how we work together.',
      readMinutes: 4,
      sections: [
        {
          id: 'profile',
          heading: 'A complete profile, from design to going live',
          blocks: [
            { kind: 'p', text: 'A fullstack developer handles the interface the user sees, the server-side logic and the database. The DevOps side adds deployment, automation and monitoring: your application goes online cleanly and stays available.' },
          ],
        },
        {
          id: 'technologies',
          heading: 'Technologies I use',
          blocks: [
            { kind: 'ul', items: [
              'Frontend: React, Next.js, TypeScript, JavaScript, Tailwind CSS, Angular, HTML and CSS.',
              'Backend: Node.js, Express, PHP and Laravel, Python, REST and GraphQL APIs.',
              'Databases: PostgreSQL, MySQL, MongoDB, Redis.',
              'Mobile: Flutter and Kotlin.',
              'DevOps: Docker, Kubernetes, GitHub Actions, Terraform, AWS, Vercel, Linux, Nginx.',
              'Monitoring and quality: Git, Prometheus, Grafana, Postman.',
            ] },
          ],
        },
        {
          id: 'types-of-assignment',
          heading: 'Types of assignment',
          blocks: [
            { kind: 'ul', items: [
              'Showcase sites, online shops and custom web applications.',
              'API and server-side service development.',
              'Setting up continuous delivery: automatic tests, build and deployment.',
              'Taking over, fixing or improving an existing application.',
              'Adding artificial intelligence to a product or a process.',
            ] },
          ],
        },
        {
          id: 'way-of-working',
          heading: 'My way of working',
          blocks: [
            { kind: 'p', text: 'Every project starts with a written quote signed online. You validate the work step by step, follow your project online and delivery ends with an acceptance report. The exact terms are in the quote.' },
            { kind: 'terms' },
          ],
        },
        {
          id: 'availability-and-contact',
          heading: 'Availability and contact',
          blocks: [
            { kind: 'p', text: 'I work from Libreville, with clients in Gabon and remotely. You can book an online call, ask for an instant quote or write to me through the contact form.' },
          ],
        },
      ],
      ctaTitle: 'An assignment to hand over?',
      ctaText: 'Describe your need: I answer with a clear quote and a schedule.',
    },
  },
  {
    slug: 'application-mobile-logiciel-sur-mesure-gabon',
    updated: '2026-11-23',
    fr: {
      title: 'Application mobile et logiciel sur mesure au Gabon : ERP, CRM, SaaS',
      description: 'Application mobile, logiciel de gestion (ERP, CRM), plateforme SaaS et digitalisation de vos processus au Gabon : quand les choisir et comment cela se passe.',
      intro: 'Votre activité repose sur des fichiers Excel, des carnets ou des messages dispersés ? Un logiciel sur mesure ou une application mobile peut centraliser et automatiser ce travail. Ce guide explique quand c’est utile et comment le projet se déroule.',
      readMinutes: 5,
      sections: [
        {
          id: 'quand-un-logiciel-sur-mesure',
          heading: 'Quand un logiciel sur mesure est la bonne réponse',
          blocks: [
            { kind: 'ul', items: [
              'Vos outils actuels ne correspondent pas à votre façon de travailler.',
              'Les mêmes informations sont ressaisies à plusieurs endroits.',
              'Vous voulez suivre clients, stocks, commandes ou dossiers au même endroit.',
              'Plusieurs personnes doivent travailler ensemble avec des droits différents.',
            ] },
          ],
        },
        {
          id: 'ce-que-je-realise',
          heading: 'Ce que je réalise',
          blocks: [
            { kind: 'ul', items: [
              'Logiciels de gestion : ERP et CRM adaptés à votre activité.',
              'Plateformes SaaS : un service accessible par abonnement ou par compte.',
              'Applications mobiles pour Android et iOS.',
              'Tableaux de bord, rapports et exports.',
              'Automatisation de tâches répétitives et de flux de documents.',
            ] },
          ],
        },
        {
          id: 'digitaliser-vos-processus',
          heading: 'Digitaliser vos processus',
          blocks: [
            { kind: 'p', text: 'Digitaliser, c’est décrire votre processus réel, retirer ce qui est inutile, puis le faire exécuter par un outil simple : demandes, validations, suivis, documents, notifications. On commence par ce qui vous fait perdre le plus de temps, puis on étend.' },
          ],
        },
        {
          id: 'deroulement',
          heading: 'Comment se déroule le projet',
          blocks: [
            { kind: 'ul', items: [
              'Cadrage : vos besoins, vos utilisateurs et ce qui est indispensable au départ.',
              'Devis écrit, signé en ligne.',
              'Développement par étapes, avec des points de validation.',
              'Recette, mise en ligne et formation à l’outil.',
              'Suivi après la livraison selon les conditions du devis.',
            ] },
            { kind: 'terms' },
          ],
        },
        {
          id: 'sur-mesure-ou-solution-existante',
          heading: 'Sur mesure ou solution existante ?',
          blocks: [
            { kind: 'p', text: 'Si un outil existant couvre votre besoin, prenez-le : c’est plus rapide. Le sur mesure se justifie quand votre façon de travailler est spécifique, quand vous voulez posséder l’outil et son code, ou quand les solutions du marché obligent à contourner vos règles. Je vous le dis franchement lors du cadrage.' },
          ],
        },
      ],
      ctaTitle: 'Un outil à construire pour votre activité ?',
      ctaText: 'Racontez-moi votre quotidien : on identifie ce qui vaut la peine d’être automatisé.',
    },
    en: {
      title: 'Mobile app and custom software in Gabon: ERP, CRM, SaaS',
      description: 'Mobile app, management software (ERP, CRM), SaaS platform and process digitalisation in Gabon: when to choose them and how it works.',
      intro: 'Does your business rely on spreadsheets, notebooks or scattered messages? Custom software or a mobile app can centralise and automate that work. This guide explains when it helps and how the project runs.',
      readMinutes: 5,
      sections: [
        {
          id: 'when-custom-software',
          heading: 'When custom software is the right answer',
          blocks: [
            { kind: 'ul', items: [
              'Your current tools do not match the way you work.',
              'The same information is typed again in several places.',
              'You want to follow customers, stock, orders or files in one place.',
              'Several people must work together with different rights.',
            ] },
          ],
        },
        {
          id: 'what-i-build',
          heading: 'What I build',
          blocks: [
            { kind: 'ul', items: [
              'Management software: ERP and CRM adapted to your activity.',
              'SaaS platforms: a service available by subscription or account.',
              'Mobile apps for Android and iOS.',
              'Dashboards, reports and exports.',
              'Automation of repetitive tasks and document flows.',
            ] },
          ],
        },
        {
          id: 'digitalising-your-processes',
          heading: 'Digitalising your processes',
          blocks: [
            { kind: 'p', text: 'Digitalising means describing your real process, removing what is useless, then letting a simple tool run it: requests, approvals, follow-ups, documents, notifications. We start with what costs you the most time, then extend.' },
          ],
        },
        {
          id: 'how-it-runs',
          heading: 'How the project runs',
          blocks: [
            { kind: 'ul', items: [
              'Scoping: your needs, your users and what is essential at the start.',
              'A written quote, signed online.',
              'Development in steps, with validation points.',
              'Acceptance, going live and training on the tool.',
              'Follow-up after delivery according to the quote’s terms.',
            ] },
            { kind: 'terms' },
          ],
        },
        {
          id: 'custom-or-existing',
          heading: 'Custom or an existing solution?',
          blocks: [
            { kind: 'p', text: 'If an existing tool covers your need, take it: it is faster. Custom work is justified when the way you work is specific, when you want to own the tool and its code, or when market solutions force you to work around your rules. I will tell you plainly during scoping.' },
          ],
        },
      ],
      ctaTitle: 'A tool to build for your business?',
      ctaText: 'Tell me about your day-to-day: we identify what is worth automating.',
    },
  },
  {
    slug: 'chatbot-assistant-ia-rag-entreprise-gabon',
    updated: '2026-11-23',
    fr: {
      title: 'Chatbot et assistant IA sur mesure pour entreprise : RAG et agents IA',
      description: 'Chatbot, assistant IA, système RAG et agents autonomes pour votre entreprise au Gabon : à quoi cela sert, comment cela fonctionne, comment démarrer.',
      intro: 'Un assistant IA peut répondre à vos clients, retrouver une information dans vos documents ou automatiser une tâche. Ce guide explique, sans jargon, ce que sont un chatbot, un système RAG et un agent IA, et comment démarrer un projet raisonnable.',
      readMinutes: 5,
      sections: [
        {
          id: 'a-quoi-ca-sert',
          heading: 'À quoi sert un assistant IA en entreprise',
          blocks: [
            { kind: 'ul', items: [
              'Répondre aux questions fréquentes de vos clients sur votre site, à toute heure.',
              'Aider votre équipe à retrouver une information dans vos documents.',
              'Préparer des brouillons de réponses, de devis ou de comptes rendus.',
              'Faire gagner du temps sur les tâches répétitives, sous votre contrôle.',
            ] },
          ],
        },
        {
          id: 'chatbot-rag-agent',
          heading: 'Chatbot, RAG, agent : la différence',
          blocks: [
            { kind: 'ul', items: [
              'Le chatbot : une conversation en langage naturel, qui répond à partir de ce qu’on lui a donné.',
              'Le système RAG : le chatbot consulte d’abord vos propres documents avant de répondre, ce qui limite les réponses inventées.',
              'L’agent IA : un assistant capable d’utiliser des outils (consulter une base, préparer un document, déclencher une action) pour accomplir une tâche.',
            ] },
          ],
        },
        {
          id: 'fiabilite-et-controle',
          heading: 'Fiabilité et contrôle',
          blocks: [
            { kind: 'p', text: 'Une IA peut se tromper. Un projet sérieux limite ce risque : réponses appuyées sur vos documents, sujets cadrés, actions importantes soumises à votre validation, et passage à un humain quand l’assistant ne sait pas. Rien d’irréversible ne se fait sans votre accord.' },
          ],
        },
        {
          id: 'integration-a-votre-site',
          heading: 'Intégration à votre site ou à votre outil',
          blocks: [
            { kind: 'p', text: 'L’assistant peut s’intégrer à votre site web, à votre application ou à vos outils internes. Vos données restent maîtrisées : on décide ensemble de ce que l’assistant peut lire, et de ce qu’il ne doit jamais voir.' },
          ],
        },
        {
          id: 'comment-demarrer',
          heading: 'Comment démarrer',
          blocks: [
            { kind: 'ul', items: [
              'Choisir un seul cas d’usage utile et mesurable.',
              'Rassembler les documents de référence.',
              'Réaliser une première version, la tester avec de vraies questions.',
              'Corriger, puis étendre à d’autres usages.',
            ] },
            { kind: 'terms' },
          ],
        },
      ],
      ctaTitle: 'Un assistant IA pour votre entreprise ?',
      ctaText: 'Décrivez la tâche que vous voulez alléger : on voit si l’IA est la bonne réponse.',
    },
    en: {
      title: 'Custom chatbot and AI assistant for business: RAG and AI agents',
      description: 'Chatbot, AI assistant, RAG system and autonomous agents for your business in Gabon: what they are for, how they work, how to start.',
      intro: 'An AI assistant can answer your customers, find information in your documents or automate a task. This guide explains, without jargon, what a chatbot, a RAG system and an AI agent are, and how to start a sensible project.',
      readMinutes: 5,
      sections: [
        {
          id: 'what-it-is-for',
          heading: 'What an AI assistant is for in a business',
          blocks: [
            { kind: 'ul', items: [
              'Answering your customers’ frequent questions on your site, at any hour.',
              'Helping your team find information in your documents.',
              'Preparing drafts of replies, quotes or reports.',
              'Saving time on repetitive tasks, under your control.',
            ] },
          ],
        },
        {
          id: 'chatbot-rag-agent',
          heading: 'Chatbot, RAG, agent: the difference',
          blocks: [
            { kind: 'ul', items: [
              'The chatbot: a natural-language conversation that answers from what it was given.',
              'The RAG system: the chatbot first looks up your own documents before answering, which limits invented answers.',
              'The AI agent: an assistant able to use tools (query a database, prepare a document, trigger an action) to complete a task.',
            ] },
          ],
        },
        {
          id: 'reliability-and-control',
          heading: 'Reliability and control',
          blocks: [
            { kind: 'p', text: 'An AI can be wrong. A serious project limits that risk: answers backed by your documents, framed topics, important actions subject to your approval, and a hand-over to a human when the assistant does not know. Nothing irreversible happens without your agreement.' },
          ],
        },
        {
          id: 'integration-with-your-site',
          heading: 'Integration with your site or your tool',
          blocks: [
            { kind: 'p', text: 'The assistant can be built into your website, your application or your internal tools. Your data stays under control: we decide together what the assistant may read, and what it must never see.' },
          ],
        },
        {
          id: 'how-to-start',
          heading: 'How to start',
          blocks: [
            { kind: 'ul', items: [
              'Choose a single useful, measurable use case.',
              'Gather the reference documents.',
              'Build a first version and test it with real questions.',
              'Fix, then extend to other uses.',
            ] },
            { kind: 'terms' },
          ],
        },
      ],
      ctaTitle: 'An AI assistant for your business?',
      ctaText: 'Describe the task you want to lighten: we will see whether AI is the right answer.',
    },
  },
]
