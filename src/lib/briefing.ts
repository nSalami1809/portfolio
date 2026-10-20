// "What needs me today" — computed by the code from numbers the back-office already
// has. No model is involved (so it costs no quota and cannot make things up), and
// nothing is sent anywhere: it is shown to the administrator, or handed to the
// assistant WITHOUT client names.
import type { BusinessStats, TodoKind } from '@/lib/business-stats'
import type { FollowUp } from '@/lib/assistant/reminders'

export interface BriefingCounts {
  unreadContacts: number
  unreadQuotes: number
  unreadBookings: number
  pendingTestimonials: number
  failedMails: number
  unreadChats: number
  assistantDrafts: number
}

export interface BriefingInputs {
  business: BusinessStats | null
  counts: BriefingCounts
  bookingsToday: number
  bookingsTomorrow: number
  /** Quotes waiting for an answer that are due a reminder today (see quotesToFollowUp). */
  followUps?: FollowUp[]
}

export type BriefingLevel = 'urgent' | 'todo' | 'info'

export interface BriefingItem {
  id: string
  level: BriefingLevel
  title: string
  detail?: string
  href: string
}

export interface Briefing {
  summary: string
  items: BriefingItem[]
}

const ORDER: Record<BriefingLevel, number> = { urgent: 0, todo: 1, info: 2 }
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`

const TODO: Record<TodoKind, { level: BriefingLevel; title: (n: number) => string; href: string }> = {
  issue_deposit: { level: 'todo', title: (n) => `${plural(n, "facture d'acompte", "factures d'acompte")} à émettre`, href: '/admin/quotes' },
  issue_balance: { level: 'todo', title: (n) => `${plural(n, 'facture de solde', 'factures de solde')} à émettre`, href: '/admin/quotes' },
  invoice_overdue: { level: 'urgent', title: (n) => `${plural(n, 'facture', 'factures')} en retard de paiement`, href: '/admin/invoices' },
  quote_expiring: { level: 'todo', title: (n) => `${plural(n, 'devis expire', 'devis expirent')} bientôt`, href: '/admin/quotes' },
  recette_deemed: { level: 'info', title: (n) => `${plural(n, 'recette réputée', 'recettes réputées')} acceptée${n > 1 ? 's' : ''}`, href: '/admin/quotes' },
}

/**
 * @param includeNames false when the result goes to the assistant: quote numbers
 *   are kept (they are references), client names never are.
 */
export function buildBriefing(inputs: BriefingInputs, opts: { includeNames: boolean }): Briefing {
  const items: BriefingItem[] = []
  const { business, counts } = inputs

  if (business) {
    const byKind = new Map<TodoKind, typeof business.todo>()
    for (const t of business.todo) byKind.set(t.kind, [...(byKind.get(t.kind) ?? []), t])
    for (const [kind, list] of byKind) {
      const rule = TODO[kind]
      const refs = list.slice(0, 4).map((t) => (opts.includeNames && t.clientNom ? `${t.numero} · ${t.clientNom}` : t.numero))
      items.push({ id: `todo:${kind}`, level: rule.level, title: rule.title(list.length), detail: refs.join(', ') + (list.length > 4 ? '…' : ''), href: rule.href })
    }
    if (business.cash.overdueCount > 0) {
      items.push({ id: 'cash:overdue', level: 'urgent', title: `${fcfa(business.cash.overdue)} en retard (${plural(business.cash.overdueCount, 'facture', 'factures')})`, href: '/admin/invoices' })
    }
    const lateProjects = business.inProgress.filter((p) => p.late)
    if (lateProjects.length > 0) {
      items.push({
        id: 'projects:late', level: 'urgent', title: `${plural(lateProjects.length, 'projet', 'projets')} en retard sur la livraison prévue`,
        detail: lateProjects.slice(0, 4).map((p) => (opts.includeNames ? `${p.numero} · ${p.clientNom}` : p.numero)).join(', '), href: '/admin/business',
      })
    }
  }

  const followUps = inputs.followUps ?? []
  if (followUps.length > 0) {
    const refs = followUps.slice(0, 4).map((f) => {
      const state = f.reminders > 0 ? `relancé ${f.reminders} fois` : 'jamais relancé'
      return `${opts.includeNames && f.clientNom ? `${f.numero} · ${f.clientNom}` : f.numero} (${f.daysWaiting} j, ${state})`
    })
    items.push({
      id: 'quotes:followup', level: 'todo', title: plural(followUps.length, 'devis à relancer', 'devis à relancer'),
      detail: refs.join(', ') + (followUps.length > 4 ? '…' : ''), href: '/admin/assistant',
    })
  }
  if (counts.failedMails > 0) items.push({ id: 'mail:failed', level: 'urgent', title: `${plural(counts.failedMails, 'e-mail', 'e-mails')} en échec d'envoi`, detail: 'Un client n’a peut-être rien reçu.', href: '/admin/emails' })
  if (counts.unreadContacts > 0) items.push({ id: 'contacts:unread', level: 'todo', title: `${plural(counts.unreadContacts, 'nouveau message', 'nouveaux messages')} de contact`, href: '/admin/contacts' })
  if (counts.unreadQuotes > 0) items.push({ id: 'quotes:unread', level: 'todo', title: `${plural(counts.unreadQuotes, 'devis non lu', 'devis non lus')}`, href: '/admin/quotes' })
  if (counts.unreadBookings > 0) items.push({ id: 'bookings:unread', level: 'todo', title: `${plural(counts.unreadBookings, 'rendez-vous non lu', 'rendez-vous non lus')}`, href: '/admin/calendar' })
  if (counts.pendingTestimonials > 0) items.push({ id: 'testimonials:pending', level: 'todo', title: `${plural(counts.pendingTestimonials, 'témoignage', 'témoignages')} à modérer`, href: '/admin/testimonials' })
  if (inputs.bookingsToday > 0) items.push({ id: 'bookings:today', level: 'info', title: `${plural(inputs.bookingsToday, 'rendez-vous', 'rendez-vous')} aujourd’hui`, href: '/admin/calendar' })
  if (inputs.bookingsTomorrow > 0) items.push({ id: 'bookings:tomorrow', level: 'info', title: `${plural(inputs.bookingsTomorrow, 'rendez-vous', 'rendez-vous')} demain`, href: '/admin/calendar' })
  if (counts.unreadChats > 0) items.push({ id: 'chats:unread', level: 'info', title: `${plural(counts.unreadChats, 'conversation du chatbot non lue', 'conversations du chatbot non lues')}`, href: '/admin/chats' })
  if (counts.assistantDrafts > 0) items.push({ id: 'assistant:drafts', level: 'info', title: `${plural(counts.assistantDrafts, 'brouillon', 'brouillons')} de l'assistant à relire`, href: '/admin/assistant' })

  items.sort((a, b) => ORDER[a.level] - ORDER[b.level])
  const urgent = items.filter((i) => i.level === 'urgent').length
  const todo = items.filter((i) => i.level === 'todo').length
  const summary = items.length === 0
    ? 'Rien à traiter pour le moment.'
    : [urgent ? plural(urgent, 'urgence', 'urgences') : '', todo ? plural(todo, 'chose à traiter', 'choses à traiter') : ''].filter(Boolean).join(' · ') || 'Rien d’urgent.'
  return { summary, items }
}
