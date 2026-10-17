// Which back-office page the admin is on, as far as the assistant is concerned.
// The browser sends only a short KEY ("quotes"); the label and the hint given to the
// model come from this table, never from the browser, so the context cannot be used
// to slip text into the prompt. Pure.

export interface ContextChip { label: string; prompt: string; mode?: 'send' | 'fill' }
export interface PageContext {
  key: string
  /** Name of the page as the admin sees it in the menu. */
  label: string
  chips: ContextChip[]
}

const TABLE: PageContext[] = [
  {
    key: 'quotes', label: 'Devis',
    chips: [
      { label: 'Devis en attente', prompt: 'Liste mes devis en attente de réponse, du plus ancien au plus récent.' },
      { label: 'Préparer une relance', prompt: 'Prépare un brouillon de mail de relance pour le devis qui attend depuis le plus longtemps.' },
    ],
  },
  {
    key: 'blog', label: 'Blog',
    chips: [
      { label: 'Quoi écrire ensuite ?', prompt: "Quels sont mes articles les plus lus, et que me conseilles-tu d'écrire ensuite ?" },
      { label: 'Rédiger un article', prompt: 'Prépare un nouvel article de blog sur : ', mode: 'fill' },
    ],
  },
  {
    key: 'chats', label: 'Conversations',
    chips: [
      { label: 'Résumer les chats', prompt: 'Que demandent mes visiteurs au chatbot, et à quelles questions ne répond-il pas bien ?' },
    ],
  },
  {
    key: 'projects', label: 'Projets',
    chips: [
      { label: 'Auditer mes projets', prompt: "Fais l'audit qualité de mon portfolio et dis-moi les 5 priorités." },
      { label: 'Compétences sous-représentées', prompt: 'Analyse mes projets et identifie les compétences techniques qui ne sont pas suffisamment représentées dans mon portfolio.' },
    ],
  },
  {
    key: 'documents', label: 'Documents',
    chips: [{ label: 'Analyser un document', prompt: 'Analyse le document suivant et résume les points importants : ', mode: 'fill' }],
  },
  {
    key: 'business', label: 'Activité',
    chips: [{ label: "Synthèse d'activité", prompt: "Fais-moi une synthèse de mon activité : devis, factures et ce qui demande une action." }],
  },
  {
    key: 'agenda', label: 'Agenda',
    chips: [{ label: "À traiter aujourd'hui", prompt: "Que dois-je traiter aujourd'hui ?" }],
  },
  {
    key: 'content', label: 'Contenu du site',
    chips: [
      { label: 'Auditer le site', prompt: "Fais l'audit qualité de mon portfolio et dis-moi les 5 priorités." },
      { label: 'Réécrire un texte', prompt: 'Réécris le texte suivant de mon site pour le rendre plus clair : ', mode: 'fill' },
    ],
  },
  {
    key: 'dashboard', label: 'Tableau de bord',
    chips: [
      { label: "À traiter aujourd'hui", prompt: "Que dois-je traiter aujourd'hui ?" },
      { label: 'Devis en attente', prompt: 'Liste mes devis en attente de réponse, du plus ancien au plus récent.' },
    ],
  },
]

const BY_KEY = new Map(TABLE.map((c) => [c.key, c]))

const PREFIXES: [string, string][] = [
  ['/admin/quotes', 'quotes'],
  ['/admin/blog', 'blog'],
  ['/admin/chats', 'chats'],
  ['/admin/projects', 'projects'],
  ['/admin/documents', 'documents'],
  ['/admin/business', 'business'],
  ['/admin/invoices', 'business'],
  ['/admin/agenda', 'agenda'],
  ['/admin/calendar', 'agenda'],
  ['/admin/offers', 'content'],
  ['/admin/skills', 'content'],
  ['/admin/experience', 'content'],
  ['/admin/vision', 'content'],
  ['/admin/personal', 'content'],
  ['/admin/testimonials', 'content'],
]

/** The page key for a URL path, or null when the assistant has nothing special to say about it. */
export function pageKeyForPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  if (path === '/admin') return 'dashboard'
  for (const [prefix, key] of PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return key
  }
  return null
}

/** Looks a key up in the table. Anything not in it (a forged key) is null. */
export function contextForKey(key: unknown): PageContext | null {
  return typeof key === 'string' ? BY_KEY.get(key) ?? null : null
}

/** The sentence added to the system prompt. Built from the table only. */
export function contextHint(key: unknown): string {
  const ctx = contextForKey(key)
  return ctx ? `\n\nContexte : l'administrateur consulte actuellement la page « ${ctx.label} » de son back-office. Utilise-le pour comprendre une demande vague (« ce devis », « cette page »), sans le mentionner à chaque réponse.` : ''
}

export const ALL_CONTEXT_KEYS: readonly string[] = TABLE.map((c) => c.key)
