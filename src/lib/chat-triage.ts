// Sorts the chatbot conversations for the admin: what the visitor wanted, whether it
// looks like a lead, and whether the bot failed to answer. Pure rules over the logged
// text, computed when the list is read: no model, no quota, nothing sent anywhere.
import type { ChatLogMessage } from '@/lib/chat-log'

export const CHAT_TAGS = ['humain', 'devis', 'rdv', 'suivi', 'tarifs', 'technique', 'parcours', 'autre'] as const
export type ChatTag = (typeof CHAT_TAGS)[number]

export const CHAT_TAG_LABEL: Record<ChatTag, string> = {
  humain: 'Veut parler à Nawaf',
  devis: 'Demande de devis',
  rdv: 'Rendez-vous',
  suivi: 'Suivi de devis',
  tarifs: 'Tarifs / délais',
  technique: 'Question technique',
  parcours: 'Parcours / projets',
  autre: 'Autre',
}

export interface ChatTriage {
  tag: ChatTag
  /** The visitor left a way to reach them, or the chat produced a quote, a booking or a help request. */
  lead: boolean
  /** The bot admitted it could not answer. */
  unanswered: boolean
  /** The first thing the visitor asked, shortened, without e-mail addresses or phone numbers. */
  summary: string
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const PHONE = /(?<![\w])(?:\+?\d[\d\s().-]{7,}\d)(?![\w])/g

const RULES: { tag: Exclude<ChatTag, 'autre'>; marker?: RegExp; words: RegExp }[] = [
  { tag: 'humain', marker: /\[requestHumanHelp\]/, words: /\b(parler (à|avec) (nawaf|un humain|quelqu)|un humain|une vraie personne|speak (to|with) (nawaf|a human|someone)|real person)\b/i },
  { tag: 'devis', marker: /\[generateQuote\]/, words: /\b(devis|quote|estimation|estimate)\b/i },
  { tag: 'rdv', marker: /\[(bookMeeting|checkAvailability|joinWaitlist)\]/, words: /\b(rendez-?vous|rdv|appel|visio|meeting|call|disponibilit|availability|book)\b/i },
  { tag: 'suivi', marker: /\[lookupQuote\]/, words: /\b(suivi|o[uù] en est|code d['’]acc[eè]s|avancement|tracking|progress|status of)\b/i },
  { tag: 'tarifs', words: /\b(prix|tarifs?|co[uû]t|combien|budget|d[ée]lai|price|pricing|cost|how much|rate)\b/i },
  { tag: 'technique', words: /\b(react|next\.?js|node|typescript|javascript|python|api|base de donn[ée]es|database|h[ée]bergement|hosting|stack|framework|seo|wordpress|mobile|application|architecture|code)\b/i },
  { tag: 'parcours', words: /\b(parcours|exp[ée]rience|comp[ée]tences?|skills?|cv|projets?|projects?|portfolio|formation|background|r[ée]alisations?)\b/i },
]

const UNANSWERED = /(je n['’]ai pas (cette |l['’])information|je ne (sais|dispose|peux) pas|je ne dispose pas|aucune information|n['’]est pas (disponible|renseign)|i (don['’]t|do not) (know|have)|i['’]m not able to|no information (on|about))/i

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

export function triageChat(messages: ChatLogMessage[]): ChatTriage {
  const visitor = messages.filter((m) => m.role === 'user').map((m) => m.text)
  const bot = messages.filter((m) => m.role === 'assistant').map((m) => m.text)
  const all = messages.map((m) => m.text).join('\n')
  const visitorText = visitor.join('\n')

  let tag: ChatTag = 'autre'
  for (const rule of RULES) {
    if ((rule.marker && rule.marker.test(all)) || rule.words.test(visitorText)) { tag = rule.tag; break }
  }

  const leftContact = new RegExp(EMAIL.source).test(visitorText) || new RegExp(PHONE.source).test(visitorText)
  const lead = leftContact || /\[(generateQuote|bookMeeting|requestHumanHelp)\]/.test(all)
  const unanswered = bot.some((t) => UNANSWERED.test(t.replace(/\[[A-Za-z]+\]/g, '')))

  const first = (visitor[0] ?? messages[0]?.text ?? '').replace(EMAIL, '[e-mail]').replace(PHONE, '[téléphone]').replace(/\s+/g, ' ').trim()
  return { tag, lead, unanswered, summary: clip(first, 120) }
}

export type ChatFilter = 'all' | 'lead' | 'unanswered' | ChatTag

export function matchesFilter(t: ChatTriage, filter: ChatFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'lead') return t.lead
  if (filter === 'unanswered') return t.unanswered
  return t.tag === filter
}
