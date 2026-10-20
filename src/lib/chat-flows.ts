// Pure helpers for two flows of the visitor chat: choosing a meeting slot with buttons, and
// confirming the summary of a quote before it is generated. Computed from what the
// assistant's tool calls already contain: nothing invented, no model, no request.
import type { ChatLocale } from '@/lib/chat-services'

// ── Booking: slots as buttons ───────────────────────────────────────────────────────────

export interface SlotDay {
  /** ISO day, YYYY-MM-DD, in the owner's time zone (Africa/Libreville). */
  date: string
  slots: string[]
}

const MAX_SLOT_DAYS = 5
const MAX_SLOTS_PER_DAY = 8

/** The days worth showing: at most 5, each with at most 8 times, malformed or empty ones dropped. */
export function visibleSlotDays(days: SlotDay[]): SlotDay[] {
  return days
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .map((d) => ({ date: d.date, slots: d.slots.filter((s) => /^\d{2}:\d{2}$/.test(s)) }))
    .filter((d) => d.slots.length > 0)
    .slice(0, MAX_SLOT_DAYS)
    .map((d) => ({ date: d.date, slots: d.slots.slice(0, MAX_SLOTS_PER_DAY) }))
}

export function formatSlotDay(locale: ChatLocale, isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/** The message a tap on a slot sends: readable for the visitor, exact (ISO day + time) for the assistant. */
export function slotMessage(locale: ChatLocale, isoDate: string, time: string): string {
  const day = formatSlotDay(locale, isoDate)
  return locale === 'en'
    ? `I'd like to book the slot on ${day} at ${time} (${isoDate}, Libreville time).`
    : `Je souhaite réserver le créneau du ${day} à ${time} (${isoDate}, heure de Libreville).`
}

// ── Quote: the summary the visitor confirms before it is generated ──────────────────────

export interface QuoteDraftInput {
  clientNom?: string
  clientSociete?: string
  descriptionProjet?: string
  brief?: Partial<Record<'objectifs' | 'publicCible' | 'fonctionnalites' | 'contenus' | 'references' | 'contraintes' | 'echeance', string>>
  items?: { designation?: string; quantite?: number; prixUnitaireHT?: number }[]
}

export interface QuoteDraftSummary {
  client: string
  project: string
  brief: { key: string; value: string }[]
  lines: { designation: string; quantity: number; unit: number; total: number }[]
  totalHT: number
}

const BRIEF_KEYS = ['objectifs', 'publicCible', 'fonctionnalites', 'contenus', 'references', 'contraintes', 'echeance'] as const

const BRIEF_LABEL: Record<ChatLocale, Record<(typeof BRIEF_KEYS)[number], string>> = {
  fr: { objectifs: 'Objectifs', publicCible: 'Public visé', fonctionnalites: 'Fonctionnalités', contenus: 'Contenus fournis', references: 'Références', contraintes: 'Contraintes', echeance: 'Échéance' },
  en: { objectifs: 'Goals', publicCible: 'Audience', fonctionnalites: 'Features', contenus: 'Content provided', references: 'References', contraintes: 'Constraints', echeance: 'Deadline' },
}

const positive = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0)

/** What the assistant understood, as plain facts: only what is in the call, totals computed here. */
export function summarizeQuoteDraft(input: QuoteDraftInput, locale: ChatLocale): QuoteDraftSummary {
  const lines = (input.items ?? [])
    .filter((i) => i.designation?.trim())
    .map((i) => {
      const quantity = Math.max(1, Math.round(positive(i.quantite)) || 1)
      const unit = positive(i.prixUnitaireHT)
      return { designation: i.designation!.trim(), quantity, unit, total: quantity * unit }
    })
  return {
    client: [input.clientNom?.trim(), input.clientSociete?.trim()].filter(Boolean).join(' · '),
    project: (input.descriptionProjet ?? '').replace(/\s+/g, ' ').trim(),
    brief: BRIEF_KEYS.flatMap((key) => {
      const value = input.brief?.[key]?.replace(/\s+/g, ' ').trim()
      return value ? [{ key: BRIEF_LABEL[locale][key], value }] : []
    }),
    lines,
    totalHT: lines.reduce((n, l) => n + l.total, 0),
  }
}

/** Sent to the assistant, as the tool's result, when the visitor asks to change the summary instead of confirming it. */
export const QUOTE_EDIT_REQUEST =
  "Le visiteur a relu le récapitulatif et souhaite le modifier avant de générer le devis. Demande-lui ce qu'il veut changer, puis rappelle generateQuote avec les informations corrigées."
