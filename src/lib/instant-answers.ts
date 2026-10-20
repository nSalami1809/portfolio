// Answers to the questions every visitor asks about how a project works, written by
// the code from the SAME business settings that print the quote and the contract. No
// model is involved: the answer is immediate, costs no free-tier request and cannot
// drift from the real terms. Anything the rules are not sure about goes to the model.
import type { ResolvedBusiness } from '@/lib/business'

export type FaqTopic = 'delai' | 'acompte' | 'paiement' | 'revisions' | 'code' | 'garantie' | 'tva' | 'process'
export type FaqLocale = 'fr' | 'en'

export interface FaqContext {
  locale: FaqLocale
  business: ResolvedBusiness
  ownerName: string
}

export interface PreviousTurn {
  /** Text of the last assistant message before the visitor's question, if any. */
  assistantText: string
  /** The assistant used a tool in it (quote, booking, human help…): a flow is in progress. */
  hadTool: boolean
}

const MAX_QUESTION_CHARS = 160

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const TOPICS: { topic: FaqTopic; re: RegExp; /** Words that mean the visitor is asking about something else. */ not?: RegExp }[] = [
  { topic: 'delai', re: /\b(delais?|duree|combien de temps|how long|lead time|turnaround|delivery time|timeline)\b/, not: /\b(devis|quote|rendez-?vous|rdv|appel|call|meeting|reponse|reply|answer)\b/ },
  { topic: 'acompte', re: /\b(acomptes?|avance|deposit|down payment|upfront)\b/ },
  { topic: 'paiement', re: /\b(paiements?|payer|reglements?|mobile money|airtel|moov|virement|moyens? de paiement|payment methods?|how (do|can) i pay|bank transfer)\b/ },
  { topic: 'revisions', re: /\b(revisions?|retouches?|ajustements?|rounds? of (changes|revisions)|changes included)\b/ },
  { topic: 'code', re: /\b(code source|source code|propriete|proprietaire|licen[cs]e|ownership|who owns)\b/ },
  { topic: 'garantie', re: /\b(garanties?|warranty|guarantee)\b/ },
  { topic: 'tva', re: /\b(tva|vat|ttc|hors taxes?|excl\.? tax|taxes?)\b/ },
  { topic: 'process', re: /\b(comment se (passe|deroule)|deroulement|etapes|how does a project|how do you work|how it works|your process|votre process)\b/ },
]

const QUESTION_START = /^(comment|quel|quelle|quels|quelles|combien|est-ce|y a-t-il|y a t il|puis-je|peut-on|pouvez|avez|what|how|do |does |is |are |can |could |will |which|when|where)/

// A question about the standard terms, not a piece of information given in the middle
// of a conversation ("je veux un site avec paiement mobile money").
function looksLikeQuestion(norm: string, raw: string): boolean {
  return raw.includes('?') || QUESTION_START.test(norm)
}

/** The one topic this message is about, or null when it is unclear, mixed or off-topic. */
export function detectTopic(text: string): FaqTopic | null {
  const raw = text.trim()
  if (!raw || raw.length > MAX_QUESTION_CHARS) return null
  // Contact details in the message: the visitor is filling in a form, not asking.
  if (/@/.test(raw) || /\d[\d\s().+-]{6,}\d/.test(raw)) return null
  const norm = normalize(raw)
  if (!looksLikeQuestion(norm, raw)) return null
  const hits = TOPICS.filter((t) => t.re.test(norm) && !(t.not && t.not.test(norm)))
  return hits.length === 1 ? hits[0].topic : null
}

const days = (n: number, fr: boolean) => (fr ? `${n} jour${n > 1 ? 's' : ''}` : `${n} day${n === 1 ? '' : 's'}`)

/** The answer, in Markdown the chat already renders. */
export function answerFor(topic: FaqTopic, ctx: FaqContext): string {
  const { business: b, ownerName } = ctx
  const fr = ctx.locale === 'fr'
  const hasDeposit = b.depositPercent > 0 && b.depositPercent < 100
  const locale = ctx.locale
  const links = fr
    ? `\n\nCes conditions sont les conditions standard. Pour un cas particulier, [écrivez à ${ownerName}](/${locale}/contact) ou [réservez un appel](/${locale}/calendrier). Le détail est sur la page [Ma méthode](/${locale}/methode).`
    : `\n\nThese are the standard terms. For a special case, [write to ${ownerName}](/${locale}/contact) or [book a call](/${locale}/calendrier). Details are on the [method page](/${locale}/methode).`

  let body = ''
  switch (topic) {
    case 'delai':
      body = fr
        ? `Le délai standard est de **${b.deliveryDays} jours ouvrés**. C'est une estimation selon la taille et la complexité du projet : le délai exact est fixé dans le devis avant la signature, il peut donc différer d'un projet à l'autre.`
        : `The standard lead time is **${b.deliveryDays} working days**. It is an estimate based on the size and complexity of the project: the exact lead time is set in the quote before signing, so it can differ from one project to another.`
      break
    case 'acompte':
      body = hasDeposit
        ? fr
          ? `Un acompte de **${b.depositPercent} %** est demandé à la signature du devis. La facture d'acompte est payable dès réception et le développement démarre après son paiement. ${b.depositRefundable ? "L'acompte est remboursable en cas d'annulation de votre part." : "L'acompte n'est pas remboursable en cas d'annulation de votre part."}`
          : `A **${b.depositPercent}%** deposit is requested when the quote is signed. The deposit invoice is payable on receipt and development starts once it is paid. ${b.depositRefundable ? 'The deposit is refundable if you cancel.' : 'The deposit is not refundable if you cancel.'}`
        : fr
          ? "Il n'y a pas d'acompte : le développement démarre après la signature du devis."
          : 'There is no deposit: development starts once the quote is signed.'
      break
    case 'paiement':
      body = fr
        ? `Moyens de paiement acceptés : **${b.paymentMethods}**. Les factures sont payables sous **${days(b.paymentDueDays, true)}** et un reçu vous est remis pour chaque paiement.`
        : `Accepted payment methods: **${b.paymentMethods}**. Invoices are payable within **${days(b.paymentDueDays, false)}** and you get a receipt for every payment.`
      break
    case 'revisions':
      body = fr
        ? `**${b.includedRevisions} cycle${b.includedRevisions > 1 ? 's' : ''} de révision** ${b.includedRevisions > 1 ? 'sont inclus' : 'est inclus'}. Un cycle est un lot groupé de demandes d'ajustement de l'existant (couleurs, textes, position d'un élément). Une nouvelle fonctionnalité n'est pas une révision : elle est facturée à part, par un avenant signé.`
        : `**${b.includedRevisions} revision round${b.includedRevisions === 1 ? ' is' : 's are'}** included. A round is one batch of adjustment requests on what exists (colours, texts, the position of an element). A new feature is not a revision: it is billed separately, through a signed amendment.`
      break
    case 'code':
      body = fr
        ? `Après paiement intégral, les droits sur les éléments développés spécifiquement pour vous vous sont cédés ; ${ownerName} garde ses outils et composants réutilisables. ${b.sourceCodeDelivery ? 'Le code source vous est remis après paiement intégral.' : "Le code source n'est remis que sur accord écrit."}`
        : `Once paid in full, the rights to the elements built specifically for you are transferred to you; ${ownerName} keeps his reusable tools and components. ${b.sourceCodeDelivery ? 'The source code is handed over after full payment.' : 'The source code is only handed over by written agreement.'}`
      break
    case 'garantie':
      body = b.warrantyDays > 0
        ? fr
          ? `Après la livraison, **${days(b.warrantyDays, true)}** de correction gratuite des anomalies sont inclus.`
          : `After delivery, **${days(b.warrantyDays, false)}** of free bug fixing are included.`
        : fr
          ? "Le projet est clôturé à la recette. Pour un suivi après la livraison, parlons-en directement."
          : 'The project is closed at acceptance. For follow-up after delivery, let us talk directly.'
      break
    case 'tva':
      body = b.vatEnabled
        ? fr
          ? `Les devis incluent une TVA de **${b.vatRate} %** : les montants sont présentés hors taxes, puis TTC.`
          : `Quotes include **${b.vatRate}%** VAT: amounts are shown excluding tax, then including tax.`
        : fr
          ? `${b.vatExemptionMention}. Les montants des devis sont donc les montants à payer.`
          : `${b.vatExemptionMention}. Quote amounts are therefore the amounts to pay.`
      break
    case 'process':
      body = fr
        ? `Un projet se déroule en étapes :\n\n1. **Brief et devis** instantané, ici ou sur la page Devis.\n2. **Signature électronique** du devis, qui donne lieu à un contrat.\n3. ${hasDeposit ? `**Acompte de ${b.depositPercent} %**, puis démarrage du développement.` : '**Démarrage** du développement après la signature.'}\n4. **Développement** avec ${b.includedRevisions} cycle${b.includedRevisions > 1 ? 's' : ''} de révision inclus.\n5. **Livraison** et procès-verbal de recette.\n6. **Solde** sur facture payable sous ${days(b.paymentDueDays, true)}${b.warrantyDays > 0 ? `, puis ${days(b.warrantyDays, true)} de correction gratuite` : ''}.`
        : `A project runs in steps:\n\n1. **Brief and instant quote**, here or on the Quote page.\n2. **Electronic signature** of the quote, which leads to a contract.\n3. ${hasDeposit ? `**${b.depositPercent}% deposit**, then development starts.` : '**Development starts** once the quote is signed.'}\n4. **Development** with ${b.includedRevisions} revision round${b.includedRevisions === 1 ? '' : 's'} included.\n5. **Delivery** and acceptance report.\n6. **Balance** on an invoice payable within ${days(b.paymentDueDays, false)}${b.warrantyDays > 0 ? `, then ${days(b.warrantyDays, false)} of free bug fixing` : ''}.`
      break
  }
  return body + links
}

export interface InstantAnswer { topic: FaqTopic; text: string }

/**
 * An instant answer for the visitor's last message, or null to let the model answer.
 * It only answers a clear question about one topic, never in the middle of a quote or
 * a booking, and never while the assistant is waiting for the visitor to answer it.
 */
export function instantAnswer(question: string, previous: PreviousTurn | null, ctx: FaqContext): InstantAnswer | null {
  if (previous?.hadTool) return null
  if (previous && /\?\s*$/.test(previous.assistantText.trim())) return null
  const topic = detectTopic(question)
  return topic ? { topic, text: answerFor(topic, ctx) } : null
}
