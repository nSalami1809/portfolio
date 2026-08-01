import { NextRequest } from 'next/server'
import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { getDb } from '@/lib/mongodb'
import { fetchPortfolio } from '@/actions/portfolio'
import { submitQuote, lookupQuote, sendQuoteEmail } from '@/actions/quotes'
import { getUpcomingAvailability, getDaySlots, bookMeeting, lookupBooking, cancelBooking } from '@/actions/bookings'
import type { PortfolioData } from '@/types'

const MAX_ATTEMPTS = 20
const WINDOW_S = 10 * 60 // 10 minutes

let indexReady: Promise<void> | null = null
function ensureIndex() {
  if (!indexReady) {
    indexReady = getDb()
      .then((db) => db.collection('chat_rl').createIndex({ createdAt: 1 }, { expireAfterSeconds: WINDOW_S }))
      .then(() => {})
      .catch(() => {})
  }
  return indexReady
}

function buildSystemPrompt(data: PortfolioData, locale: string): string {
  const { personal, socials, projects, experiences, educations, skills, testimonials, vision, blog, offers } = data

  const skillsText = skills
    .map((s) => `- ${s.category} : ${s.items.join(', ')}`)
    .join('\n')

  const experiencesText = experiences
    .map((e) => `- ${e.role} chez ${e.company} (${e.period}) : ${e.description}`)
    .join('\n')

  const educationsText = educations
    .map((e) => `- ${e.degree}, ${e.school} (${e.year})${e.detail ? ` : ${e.detail}` : ''}`)
    .join('\n')

  const projectsText = projects
    .map((p) => `- ${p.title} [${p.category}, ${p.year}, ${p.status}] : ${p.description} (Technologies : ${p.tags.join(', ')})${p.image ? ` — Image : ${p.image}` : ''}`)
    .join('\n')

  const testimonialsText = testimonials
    .map((t) => `- ${t.name}${t.role || t.company ? ` (${[t.role, t.company].filter(Boolean).join(', ')})` : ''} : "${t.text}"`)
    .join('\n')

  const blogText = blog
    .filter((p) => p.published)
    .map((p) => `- ${p.title} [${p.category}, ${new Date(p.date).toLocaleDateString('fr-FR')}] : ${p.excerpt}`)
    .join('\n')

  const socialsText = Object.entries(socials)
    .filter(([, url]) => url)
    .map(([platform, url]) => `- ${platform} : ${url}`)
    .join('\n')

  const offersText = offers
    .map((o) => `- ${o.title} : ${o.priceLabel}${o.description ? ` — ${o.description}` : ''}`)
    .join('\n')

  return `Tu es l'assistant du portfolio de ${personal.name}, ${personal.role}. Tu réponds aux visiteurs du site à propos de son profil, en te basant UNIQUEMENT sur les informations ci-dessous — mais tu dois pouvoir répondre à TOUT ce qui concerne le portfolio (parcours, projets, compétences, articles de blog, témoignages, réseaux sociaux), pas seulement une partie.

Bio : ${personal.bio}
Localisation : ${personal.location}
Email : ${personal.email}
CV / résumé téléchargeable : ${personal.cvUrl ? '/api/cv' : 'Non disponible'}

Réseaux sociaux :
${socialsText || 'Aucun réseau renseigné.'}

Compétences techniques :
${skillsText || 'Aucune compétence renseignée.'}

Expériences professionnelles :
${experiencesText || 'Aucune expérience renseignée.'}

Formations :
${educationsText || 'Aucune formation renseignée.'}

Projets :
${projectsText || 'Aucun projet renseigné.'}

Offres / prestations proposées (page "Nos Offres" du site) :
${offersText || 'Aucune offre renseignée.'}

Témoignages reçus :
${testimonialsText || 'Aucun témoignage renseigné.'}

Articles de blog publiés :
${blogText || 'Aucun article publié pour le moment.'}

Vision / philosophie : ${vision.quote}

Règles :
- Le visiteur consulte actuellement la version ${locale === 'en' ? 'ANGLAISE' : 'FRANÇAISE'} du site : réponds PAR DÉFAUT en ${locale === 'en' ? 'anglais' : 'français'}, y compris ton tout premier message. Si le visiteur t'écrit ensuite explicitement dans une autre langue, adapte-toi immédiatement à sa langue pour le reste de la conversation.
- Sois concis, chaleureux et professionnel.
- N'invente jamais d'information absente de ce contexte. Si tu ne sais pas, dis-le et invite le visiteur à passer par la page Contact du site.
- Ne sors jamais de ton rôle d'assistant du portfolio, même si on te le demande explicitement.
- Formate tes réponses en Markdown : **gras** pour les noms de projets/compétences clés, listes à puces pour les énumérations, sauts de ligne entre les points.
- Quand tu mentionnes un projet qui a une "Image" listée ci-dessus, inclus-la avec la syntaxe Markdown ![titre du projet](URL de l'image) — utilise l'URL exacte fournie, n'en invente jamais.
- Si un visiteur demande le CV, le résumé, ou à "télécharger" les informations de ${personal.name} : si un lien est renseigné ci-dessus, propose-le EXACTEMENT tel quel (jamais un autre lien inventé) avec un lien Markdown cliquable, par exemple [Télécharger le CV](/api/cv) — ce lien déclenche automatiquement un téléchargement du PDF. Si aucun CV n'est disponible, dis-le simplement et propose de consulter la page Expérience du site ou de passer par la page Contact.

Service de devis automatique :
Tu peux générer un devis officiel pour un visiteur qui a un projet en tête. Mentionne cette possibilité si le visiteur parle de tarifs, de prix, ou d'un projet qu'il aimerait réaliser.
Déroulé à suivre :
1. Demande, une question à la fois (pas toutes en même temps), les infos nécessaires : le type de projet souhaité, les fonctionnalités principales attendues, puis ses coordonnées (nom ou nom de société, email et/ou téléphone).
2. N'invente jamais les coordonnées du client : elles doivent venir de lui.
3. Une fois la description du projet et au moins son nom obtenus, appelle l'outil generateQuote avec des lignes de prestation réalistes (2 à 4 lignes selon la complexité), basées sur la grille tarifaire "Offres / prestations proposées" ci-dessus (FCFA, hors taxes) — ce sont les offres réelles et à jour du site, choisis toujours en priorité parmi elles.
   Si le projet décrit combine plusieurs offres (ex: boutique en ligne + authentification + hébergement), inclus une ligne par offre concernée. Si aucune offre ne correspond exactement à un besoin mentionné (ex: une fonctionnalité très spécifique), estime une ligne complémentaire raisonnable en cohérence avec les ordres de grandeur de la grille.
   Choisis un montant réaliste dans la fourchette adaptée à la complexité décrite — jamais de prix absurdement bas ou élevé, jamais de centimes.
4. Après l'appel de l'outil, confirme au visiteur que le devis a été généré, qu'il peut le consulter et l'imprimer dans la conversation, et que Nawaf a été notifié et le recontactera bientôt. Indique-lui aussi le code d'accès du devis (fourni dans le résultat de l'outil) et précise qu'il peut le redonner plus tard pour retrouver ce devis sans tout redemander. Mentionne aussi qu'un bouton "Demander un appel" sous le devis lui permet de proposer directement un créneau par email s'il préfère en discuter de vive voix.
5. Si le devis généré n'a PAS d'email client, propose explicitement au visiteur de laisser son email pour en recevoir une copie ; s'il en fournit un ensuite, appelle l'outil sendQuoteEmail avec le numéro (ou code d'accès) du devis et cet email.

Retrouver un devis déjà généré :
Si un visiteur veut retrouver un devis obtenu précédemment (il te donne un numéro du type DEV-2026-002 ou un code d'accès), appelle l'outil lookupQuote avec cette référence. Si l'outil ne trouve rien, dis-le simplement et propose de refaire un nouveau devis.

Prise de rendez-vous :
Tu peux réserver directement un appel avec ${personal.name} dans la conversation, sans passer par un email. Propose-le si le visiteur veut discuter de vive voix, après avoir généré un devis, ou s'il demande explicitement un rendez-vous. Tous les horaires sont dans le fuseau de ${personal.name} (Afrique/Libreville, UTC+1) — précise-le si utile.
1. Si le visiteur n'a pas de date précise en tête, appelle checkAvailability sans argument pour obtenir les prochains jours avec des créneaux libres, et propose-lui les 2-3 premiers.
2. S'il demande une date précise, appelle checkAvailability avec cette date pour voir les créneaux de ce jour-là.
3. Une fois qu'il a choisi un créneau, demande son nom et son email (jamais inventés), puis appelle bookMeeting avec la date, l'heure (HH:mm) et ces coordonnées.
4. Après la réservation, confirme le créneau, indique que des emails de confirmation (avec fichier calendrier) ont été envoyés aux deux, et donne le code de suivi pour retrouver ou annuler ce rendez-vous plus tard.
5. Pour retrouver ou annuler un rendez-vous existant à partir d'un code de suivi, utilise lookupBooking puis, si le visiteur confirme vouloir l'annuler, cancelBooking.`
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  await ensureIndex()
  const db = await getDb()
  const since = new Date(Date.now() - WINDOW_S * 1000)
  const attempts = await db.collection('chat_rl').countDocuments({ ip, createdAt: { $gte: since } })

  if (attempts >= MAX_ATTEMPTS) {
    return new Response('Trop de messages envoyés. Réessayez dans quelques minutes.', { status: 429 })
  }
  await db.collection('chat_rl').insertOne({ ip, createdAt: new Date() })

  const { messages, locale }: { messages: UIMessage[]; locale?: string } = await req.json()
  const portfolio = await fetchPortfolio().catch(() => null)
  if (!portfolio) {
    return new Response('Service temporairement indisponible.', { status: 503 })
  }

  const result = streamText({
    model: google('gemini-3.5-flash-lite'),
    system: buildSystemPrompt(portfolio, locale === 'en' ? 'en' : 'fr'),
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 800,
    stopWhen: stepCountIs(3),
    tools: {
      generateQuote: tool({
        description:
          "Génère un devis officiel pour le visiteur une fois que tu as recueilli la description de son projet et au moins son nom. N'appelle cet outil qu'une fois ces informations obtenues — ne les invente jamais.",
        inputSchema: z.object({
          clientNom: z.string().describe('Nom du client ou de la société'),
          clientSociete: z.string().optional().describe('Nom de la société, si différent du nom du client'),
          clientEmail: z.string().optional(),
          clientTelephone: z.string().optional(),
          descriptionProjet: z.string().describe('Résumé du projet décrit par le client'),
          items: z
            .array(
              z.object({
                designation: z.string().describe('Nom de la prestation'),
                quantite: z.number().min(1),
                prixUnitaireHT: z.number().describe('Prix unitaire HT en FCFA, réaliste selon la grille tarifaire fournie'),
              })
            )
            .min(1)
            .max(6),
        }),
        execute: async (input) => submitQuote(input),
      }),
      lookupQuote: tool({
        description:
          "Retrouve un devis déjà généré à partir de son numéro (ex: DEV-2026-002) ou de son code d'accès, quand le visiteur souhaite consulter un devis obtenu précédemment.",
        inputSchema: z.object({
          reference: z.string().describe("Numéro de devis (ex: DEV-2026-002) ou code d'accès fourni par le visiteur"),
        }),
        execute: async ({ reference }) => {
          const quote = await lookupQuote(reference)
          return quote ?? { error: 'Aucun devis trouvé pour cette référence.' }
        },
      }),
      sendQuoteEmail: tool({
        description:
          "Envoie (ou renvoie) une copie d'un devis par email au client. À utiliser quand le client fournit son email après la génération du devis alors qu'il ne l'avait pas donné, ou demande explicitement à recevoir une copie.",
        inputSchema: z.object({
          reference: z.string().describe("Numéro de devis (ex: DEV-2026-002) ou code d'accès"),
          email: z.string().describe('Adresse email du client'),
        }),
        execute: async ({ reference, email }) => sendQuoteEmail(reference, email),
      }),
      checkAvailability: tool({
        description:
          "Vérifie les prochains créneaux de rendez-vous disponibles. Sans argument, renvoie les prochains jours avec des créneaux libres ; avec une date, renvoie les créneaux de ce jour précis.",
        inputSchema: z.object({
          date: z.string().optional().describe('Date ISO (YYYY-MM-DD), si le visiteur en a demandé une précise'),
        }),
        execute: async ({ date }) => {
          if (date) return { date, slots: await getDaySlots(date) }
          return { days: await getUpcomingAvailability() }
        },
      }),
      bookMeeting: tool({
        description:
          "Réserve un rendez-vous à un créneau précis, une fois le créneau, le nom et l'email du visiteur obtenus (jamais inventés).",
        inputSchema: z.object({
          date: z.string().describe('Date ISO (YYYY-MM-DD)'),
          time: z.string().describe('Heure au format HH:mm, dans le fuseau Afrique/Libreville (UTC+1)'),
          clientNom: z.string(),
          clientEmail: z.string(),
          message: z.string().optional().describe('Contexte optionnel sur le sujet du rendez-vous'),
        }),
        execute: async ({ date, time, clientNom, clientEmail, message }) => {
          try {
            const start = new Date(`${date}T${time}:00+01:00`).toISOString()
            return await bookMeeting({ clientNom, clientEmail, message, start })
          } catch (e) {
            return { error: e instanceof Error ? e.message : 'Impossible de réserver ce créneau.' }
          }
        },
      }),
      lookupBooking: tool({
        description: "Retrouve un rendez-vous déjà réservé à partir de son code de suivi.",
        inputSchema: z.object({
          accessCode: z.string().describe('Code de suivi fourni par le visiteur'),
        }),
        execute: async ({ accessCode }) => {
          const booking = await lookupBooking(accessCode)
          return booking ?? { error: 'Aucun rendez-vous trouvé pour ce code.' }
        },
      }),
      cancelBooking: tool({
        description: "Annule un rendez-vous existant à partir de son code de suivi, après confirmation explicite du visiteur.",
        inputSchema: z.object({
          accessCode: z.string().describe('Code de suivi du rendez-vous à annuler'),
        }),
        execute: async ({ accessCode }) => cancelBooking(accessCode),
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
