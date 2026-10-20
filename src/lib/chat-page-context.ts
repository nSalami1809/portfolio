// What the visitor chat can offer depending on the page the visitor is on. Pure: a fixed
// table of suggestions (the title of a project or an article comes from the site's own
// data, cleaned), so the chat is useful from the first click and costs nothing until
// the visitor sends something.
import type { ChatLocale } from '@/lib/chat-services'

export interface ChatPageHint {
  kind: 'project' | 'blog'
  title: string
}

export interface HintChip {
  label: string
  /** The message sent when the chip is clicked. */
  text?: string
  /** A local panel to open instead of sending anything. */
  action?: 'services' | 'track'
}

export interface PageSuggestions {
  label: string
  chips: HintChip[]
}

/** A title as it may travel in a message: one line, no quotes that would break it, bounded. */
export function cleanTitle(raw: string, max = 120): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

const withoutLocale = (pathname: string) => pathname.replace(/^\/(fr|en)(?=\/|$)/, '') || '/'

export function pageSuggestions(pathname: string | null | undefined, hint: ChatPageHint | null, locale: ChatLocale): PageSuggestions | null {
  if (!pathname) return null
  const path = withoutLocale(pathname.split('?')[0].replace(/\/+$/, '') || '/')
  const fr = locale === 'fr'

  if (/^\/projects\/[^/]+$/.test(path) && hint?.kind === 'project' && hint.title) {
    const t = cleanTitle(hint.title)
    return {
      label: t,
      chips: fr
        ? [
            { label: 'Parler de ce projet', text: `Parle-moi du projet « ${t} ».` },
            { label: 'Un projet comme celui-ci ?', text: `J'aimerais un projet similaire à « ${t} ». Peux-tu m'orienter ?` },
          ]
        : [
            { label: 'Tell me about this project', text: `Tell me about the project "${t}".` },
            { label: 'A project like this one?', text: `I'd like a project similar to "${t}". Can you guide me?` },
          ],
    }
  }
  if (/^\/blog\/[^/]+$/.test(path) && hint?.kind === 'blog' && hint.title) {
    const t = cleanTitle(hint.title)
    return {
      label: t,
      chips: fr
        ? [
            { label: 'Résumer cet article', text: `Résume l'article « ${t} ».` },
            { label: 'Poser une question', text: `J'ai une question sur l'article « ${t} ».` },
          ]
        : [
            { label: 'Summarize this article', text: `Summarize the article "${t}".` },
            { label: 'Ask a question', text: `I have a question about the article "${t}".` },
          ],
    }
  }
  if (path === '/offres') {
    return {
      label: fr ? 'Offres et tarifs' : 'Offers and pricing',
      chips: fr
        ? [{ label: 'Voir les tarifs', action: 'services' }, { label: 'Quelle offre pour mon projet ?', text: 'Quelle offre me conseilles-tu pour mon projet ?' }]
        : [{ label: 'See pricing', action: 'services' }, { label: 'Which offer fits my project?', text: 'Which offer would you recommend for my project?' }],
    }
  }
  if (path === '/devis') {
    return {
      label: fr ? 'Devis en ligne' : 'Online quote',
      chips: fr
        ? [{ label: "J'ai besoin d'aide pour mon devis", text: "J'ai besoin d'aide pour remplir mon devis." }, { label: 'Suivre mon devis', action: 'track' }]
        : [{ label: 'I need help with my quote', text: 'I need help filling in my quote.' }, { label: 'Track my quote', action: 'track' }],
    }
  }
  if (path === '/contact' || path === '/calendrier') {
    return {
      label: path === '/contact' ? 'Contact' : fr ? 'Rendez-vous' : 'Appointments',
      chips: fr
        ? [{ label: 'Réserver un appel', text: 'Je souhaite réserver un appel avec Nawaf.' }]
        : [{ label: 'Book a call', text: "I'd like to book a call with Nawaf." }],
    }
  }
  return null
}

// ── The title the current page registers (a tiny store, read by the chat widget) ───────

let current: ChatPageHint | null = null
const listeners = new Set<() => void>()

export const getPageHint = (): ChatPageHint | null => current

export function setPageHint(hint: ChatPageHint | null): void {
  current = hint ? { kind: hint.kind, title: cleanTitle(hint.title) } : null
  listeners.forEach((l) => l())
}

export function subscribePageHint(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
