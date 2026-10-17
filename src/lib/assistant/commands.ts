// Slash commands of the admin chat: typing "/" opens a menu of ready-made requests.
// Pure data and matching (no model, no database): choosing a command either sends a
// prepared prompt or, when it needs a detail from the admin, puts the start of the
// sentence in the composer. A prepared prompt saves the back-and-forth that would
// otherwise burn free-tier requests.

export interface SlashCommand {
  /** What follows the slash. Lowercase ASCII so it is easy to type. */
  name: string
  label: string
  description: string
  /** `send`: the prompt is complete. `fill`: the admin finishes the sentence. */
  mode: 'send' | 'fill'
  prompt: string
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: 'briefing', label: 'Briefing du jour', description: "Ce qui demande ton attention aujourd'hui", mode: 'send', prompt: "Que dois-je traiter aujourd'hui ?" },
  { name: 'relance', label: 'Relance de devis', description: 'Prépare un mail de relance (brouillon, jamais envoyé)', mode: 'send', prompt: "Quels devis attendent une réponse ? Prépare un brouillon de mail de relance pour celui qui attend depuis le plus longtemps." },
  { name: 'devis', label: 'Devis en attente', description: 'Liste les devis sans réponse', mode: 'send', prompt: 'Liste mes devis en attente de réponse, du plus ancien au plus récent.' },
  { name: 'chats', label: 'Conversations du chatbot', description: 'Résume ce que demandent les visiteurs', mode: 'send', prompt: 'Que demandent mes visiteurs au chatbot, et à quelles questions ne répond-il pas bien ?' },
  { name: 'audit', label: 'Audit du portfolio', description: 'Les 5 priorités à corriger', mode: 'send', prompt: "Fais l'audit qualité de mon portfolio et dis-moi les 5 priorités." },
  { name: 'stats', label: 'Articles les plus lus', description: 'Audience et idées de prochains articles', mode: 'send', prompt: "Quels sont mes articles les plus lus, et que me conseilles-tu d'écrire ensuite ?" },
  { name: 'article', label: 'Rédiger un article', description: 'Brouillon FR + EN à relire', mode: 'fill', prompt: 'Prépare un nouvel article de blog sur : ' },
  { name: 'reecrire', label: 'Réécrire un texte du site', description: 'Une proposition avant/après, à appliquer toi-même', mode: 'fill', prompt: 'Réécris le texte suivant de mon site pour le rendre plus clair : ' },
  { name: 'document', label: 'Analyser un document', description: 'Contrat, devis, PDF ou docx de ta bibliothèque', mode: 'fill', prompt: 'Analyse le document suivant et résume les points importants : ' },
]

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** True while the composer holds only a slash and the start of a command name. */
export function isCommandInput(input: string): boolean {
  return /^\/[a-zà-ÿ]*$/i.test(input)
}

/** Commands whose name starts with what was typed after the slash, in menu order. */
export function matchCommands(input: string): SlashCommand[] {
  if (!isCommandInput(input)) return []
  const typed = normalize(input.slice(1))
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(typed))
}

/** The command typed in full ("/relance"), if any. */
export function exactCommand(input: string): SlashCommand | null {
  if (!isCommandInput(input)) return null
  const typed = normalize(input.slice(1))
  return SLASH_COMMANDS.find((c) => c.name === typed) ?? null
}

// The four entry cards of the empty chat.
export const START_CARDS: readonly { key: string; title: string; hint: string; command: SlashCommand['name'] }[] = [
  { key: 'article', title: 'Rédiger un article', hint: 'Brouillon français + anglais, prêt à relire.', command: 'article' },
  { key: 'audit', title: 'Auditer le site', hint: 'Les priorités : contenus, liens, compétences.', command: 'audit' },
  { key: 'document', title: 'Analyser un document', hint: 'Contrat, devis, PDF ou docx.', command: 'document' },
  { key: 'chats', title: 'Résumer les chats', hint: 'Ce que demandent les visiteurs.', command: 'chats' },
]

export function commandByName(name: string): SlashCommand | undefined {
  return SLASH_COMMANDS.find((c) => c.name === name)
}
