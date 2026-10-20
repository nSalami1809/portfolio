// The back-office command palette (Ctrl+K): what a typed query turns into. Pure: the pages
// come from the menu, the quotes from a read-only search, the rest is ranking. The first
// row is always a way to ask NemCopilotIA, so the palette never leaves you without a next step.

export interface PalettePage {
  href: string
  label: string
}

export interface PaletteQuote {
  numero: string
  clientNom: string
  status: string
  totalTTC: number
}

export type PaletteEntry =
  | { id: string; kind: 'ask'; label: string; hint: string; href: string }
  | { id: string; kind: 'robot'; label: string; hint: string }
  | { id: string; kind: 'page'; label: string; hint: string; href: string }
  | { id: string; kind: 'quote'; label: string; hint: string; href: string }

export const normalize = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Extra words that find a page the way the admin thinks about it, not only by its label.
const KEYWORDS: Record<string, string> = {
  '/admin': 'accueil dashboard aujourd hui',
  '/admin/quotes': 'devis pipeline relance relancer client contrat signature',
  '/admin/invoices': 'factures paiement encaisser acompte solde recu',
  '/admin/business': 'activite chiffre affaires statistiques cash',
  '/admin/chats': 'chatbot conversations visiteurs pouce leads',
  '/admin/contacts': 'messages contact mails formulaire',
  '/admin/calendar': 'rendez vous agenda disponibilites rdv',
  '/admin/blog': 'article articles ecrire publier seo',
  '/admin/assistant': 'ia copilot nemcopilotia brouillons assistant',
  '/admin/settings': 'parametres reglages theme securite',
  '/admin/personal': 'profil bio reseaux photo conditions tva acompte',
  '/admin/documents': 'documents pdf fichiers cv',
  '/admin/backups': 'sauvegardes backup export',
}

/** Pages whose label or keywords match, best first. Empty query: the first `limit` pages. */
export function rankPages(pages: PalettePage[], query: string, limit = 6): PalettePage[] {
  const q = normalize(query)
  if (!q) return pages.slice(0, limit)
  const scored = pages.map((p) => {
    const label = normalize(p.label)
    const words = `${label} ${KEYWORDS[p.href] ?? ''}`
    let score = 0
    if (label.startsWith(q)) score = 4
    else if (label.split(' ').some((w) => w.startsWith(q))) score = 3
    else if (label.includes(q)) score = 2
    else if (words.split(' ').some((w) => w.startsWith(q))) score = 1
    else if (q.split(' ').every((w) => words.includes(w))) score = 1
    return { p, score }
  })
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.p)
}

/** What the admin typed, kept short and plain before it travels in an address or a search. */
export function cleanQuery(raw: string, max = 200): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export const askHref = (text: string) => `/admin/assistant?prefill=${encodeURIComponent(cleanQuery(text, 500))}`

const STATUS_LABEL: Record<string, string> = { pending: 'En attente', accepted: 'Accepté', declined: 'Refusé' }

export function buildEntries(query: string, pages: PalettePage[], quotes: PaletteQuote[]): PaletteEntry[] {
  const q = cleanQuery(query)
  const out: PaletteEntry[] = []
  if (q.length >= 3) {
    out.push({ id: 'ask', kind: 'ask', label: `Demander à NemCopilotIA : « ${q} »`, hint: 'Ouvre la discussion avec ta question prête, tu l’envoies toi-même', href: askHref(q) })
  } else {
    out.push({ id: 'robot', kind: 'robot', label: 'Ouvrir NemCopilotIA', hint: 'Le robot, sur la page où tu es' })
  }
  for (const quote of quotes.slice(0, 5)) {
    out.push({
      id: `quote:${quote.numero}`, kind: 'quote', label: `${quote.numero} · ${quote.clientNom}`,
      hint: `${STATUS_LABEL[quote.status] ?? quote.status} · ${Math.round(quote.totalTTC).toLocaleString('fr-FR')} FCFA`,
      href: `/admin/quotes?q=${encodeURIComponent(quote.numero)}`,
    })
  }
  for (const page of rankPages(pages, q, q ? 6 : 8)) {
    out.push({ id: `page:${page.href}`, kind: 'page', label: page.label, hint: page.href.replace('/admin', '') || 'Accueil', href: page.href })
  }
  return out
}

/** Moves the highlighted row, wrapping around. */
export const moveIndex = (index: number, delta: number, length: number): number => (length === 0 ? 0 : (index + delta + length) % length)

/** A quote search only makes sense from two characters on, and never as a regular expression. */
export function quoteSearchTerm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const term = cleanQuery(raw, 40)
  return term.length >= 2 ? term : null
}

export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
