// Reminder e-mails for quotes that wait for an answer. Built from a template, by the
// code, from the real quote: no model is involved, so it costs no free-tier request
// and the client's name and address never go to Google. The result is a DRAFT that
// the admin copies or opens in their own mail app; nothing here can send anything.
import { z } from 'zod'

export const REMINDER_TONES = ['courtois', 'direct', 'dernier'] as const
export type ReminderTone = (typeof REMINDER_TONES)[number]
export const reminderToneSchema = z.enum(REMINDER_TONES)

/** A quote still waiting for the client's answer, as read from the database. */
export interface PendingQuote {
  numero: string
  clientNom: string
  clientSociete?: string
  clientEmail?: string
  locale: 'fr' | 'en'
  /** ISO date the quote was issued. */
  dateEmission: string
  validiteJours: number
  totalTTC: number
  signToken?: string
}

/** What the model may see of a pending quote: a reference and numbers, never a name or address. */
export interface PendingQuoteView {
  numero: string
  daysWaiting: number
  expiresInDays: number
  expired: boolean
  totalTTC: number
  hasEmail: boolean
  /** Reminders already sent for this quote (marked by the admin), and when the last one went. */
  remindersSent: number
  daysSinceLastReminder: number | null
  /** The tone that fits the next reminder. */
  suggestedTone: ReminderTone
}

export interface ReminderPayload {
  quoteNumero: string
  to: string | null
  toName: string
  subject: string
  body: string
  tone: ReminderTone
  locale: 'fr' | 'en'
  daysWaiting: number
  expired: boolean
}

const DAY = 86_400_000

export const daysBetween = (fromIso: string, now: Date): number => Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY))

export function expiryOf(q: Pick<PendingQuote, 'dateEmission' | 'validiteJours'>): Date {
  return new Date(new Date(q.dateEmission).getTime() + q.validiteJours * DAY)
}

export function viewOf(q: PendingQuote, now: Date, history?: Map<string, ReminderHistoryEntry>): PendingQuoteView {
  const left = Math.ceil((expiryOf(q).getTime() - now.getTime()) / DAY)
  const h = history?.get(q.numero)
  const count = h?.count ?? 0
  return {
    numero: q.numero, daysWaiting: daysBetween(q.dateEmission, now), expiresInDays: left, expired: left < 0, totalTTC: q.totalTTC, hasEmail: Boolean(q.clientEmail),
    remindersSent: count, daysSinceLastReminder: h?.lastAt ? daysBetween(h.lastAt, now) : null, suggestedTone: suggestTone(count, left < 0),
  }
}

/** Oldest first: the quote that has waited the longest is the first to follow up. */
export function oldestFirst<T extends { dateEmission: string }>(quotes: T[]): T[] {
  return [...quotes].sort((a, b) => new Date(a.dateEmission).getTime() - new Date(b.dateEmission).getTime())
}

const money = (n: number, locale: 'fr' | 'en') => `${Math.round(n).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR')} FCFA`
const dayLabel = (d: Date, locale: 'fr' | 'en') => d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' })

/** First name or company, for the greeting. Falls back to the full name. */
function greetingName(q: Pick<PendingQuote, 'clientNom' | 'clientSociete'>): string {
  return (q.clientNom || q.clientSociete || '').trim()
}

interface BuildOptions {
  tone: ReminderTone
  now: Date
  adminName: string
  siteUrl: string
}

export function buildReminder(q: PendingQuote, opts: BuildOptions): ReminderPayload {
  const { tone, now, adminName, siteUrl } = opts
  const locale = q.locale === 'en' ? 'en' : 'fr'
  const waiting = daysBetween(q.dateEmission, now)
  const expiry = expiryOf(q)
  const expired = expiry.getTime() < now.getTime()
  const name = greetingName(q)
  const issued = dayLabel(new Date(q.dateEmission), locale)
  const until = dayLabel(expiry, locale)
  const link = q.signToken ? `${siteUrl.replace(/\/$/, '')}/${locale}/devis/signature/${q.signToken}` : ''
  const amount = money(q.totalTTC, locale)

  const fr = {
    hello: name ? `Bonjour ${name},` : 'Bonjour,',
    courtois: `Je me permets de revenir vers vous au sujet du devis ${q.numero}, émis le ${issued} pour un montant de ${amount} TTC. Avez-vous eu le temps d'en prendre connaissance ?`,
    direct: `Le devis ${q.numero} (${amount} TTC, émis le ${issued}) est toujours en attente de votre réponse depuis ${waiting} jour${waiting > 1 ? 's' : ''}. Pouvez-vous me dire où vous en êtes ?`,
    dernier: expired
      ? `Le devis ${q.numero} (${amount} TTC) a expiré le ${until}. Si votre projet est toujours d'actualité, je peux le réactualiser rapidement ; sinon, n'hésitez pas à me le dire pour que je clôture le dossier.`
      : `Le devis ${q.numero} (${amount} TTC) arrive à échéance le ${until}. Passé cette date, il ne sera plus valable. Souhaitez-vous le valider, ou en discuter avant ?`,
    validity: expired ? '' : `Il reste valable jusqu'au ${until}.`,
    sign: link ? `Vous pouvez le consulter et le signer en ligne ici : ${link}` : '',
    help: "Je reste disponible pour toute question ou ajustement, par message ou par appel.",
    bye: 'Cordialement,',
    subject: (t: ReminderTone) => (t === 'dernier' ? (expired ? `Devis ${q.numero} expiré` : `Devis ${q.numero} : échéance le ${until}`) : `Suite à notre devis ${q.numero}`),
  }
  const en = {
    hello: name ? `Hello ${name},` : 'Hello,',
    courtois: `I'm following up on quote ${q.numero}, issued on ${issued} for ${amount} (tax included). Have you had a chance to look at it?`,
    direct: `Quote ${q.numero} (${amount} tax included, issued on ${issued}) has been waiting for your answer for ${waiting} day${waiting > 1 ? 's' : ''}. Could you tell me where you stand?`,
    dernier: expired
      ? `Quote ${q.numero} (${amount} tax included) expired on ${until}. If your project is still on, I can update it quickly; otherwise just let me know and I'll close the file.`
      : `Quote ${q.numero} (${amount} tax included) expires on ${until}, after which it will no longer be valid. Would you like to approve it, or talk it over first?`,
    validity: expired ? '' : `It remains valid until ${until}.`,
    sign: link ? `You can review and sign it online here: ${link}` : '',
    help: 'I remain available for any question or adjustment, by message or by call.',
    bye: 'Kind regards,',
    subject: (t: ReminderTone) => (t === 'dernier' ? (expired ? `Quote ${q.numero} has expired` : `Quote ${q.numero}: expires on ${until}`) : `Following up on quote ${q.numero}`),
  }
  const t = locale === 'en' ? en : fr
  const lines = [t.hello, '', t[tone], tone === 'dernier' ? '' : t.validity, t.sign, '', t.help, '', t.bye, adminName]
  // Collapse the blank lines left by the parts that do not apply.
  const body = lines.filter((l, i, arr) => !(l === '' && (arr[i - 1] === '' || i === 0))).join('\n').replace(/\n{3,}/g, '\n\n').trim()

  return {
    quoteNumero: q.numero,
    to: q.clientEmail?.trim() || null,
    toName: name,
    subject: t.subject(tone),
    body,
    tone,
    locale,
    daysWaiting: waiting,
    expired,
  }
}

export const MAX_SUBJECT_CHARS = 200
export const MAX_BODY_CHARS = 4000

/** The admin's edits of a reminder, kept plain and bounded before they are saved. Null if there is nothing to save. */
export function cleanEmailText(input: { subject: unknown; body: unknown }): { subject: string; body: string } | null {
  if (typeof input.subject !== 'string' || typeof input.body !== 'string') return null
  // Control characters out (a line break stays a line break); an address line cannot hide in the subject.
  const plain = (s: string) => s.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
  const subject = plain(input.subject).replace(/\s+/g, ' ').trim().slice(0, MAX_SUBJECT_CHARS)
  const body = plain(input.body).trim().slice(0, MAX_BODY_CHARS)
  return subject && body ? { subject, body } : null
}

/** A mailto: link that opens the admin's own mail app with the draft filled in. Sends nothing by itself. */
export function mailtoHref(payload: Pick<ReminderPayload, 'to' | 'subject' | 'body'>): string {
  const params = `subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.body)}`
  return `mailto:${encodeURIComponent(payload.to ?? '').replace(/%40/g, '@')}?${params}`
}

// ── What was already sent ───────────────────────────────────────────────────────────────
// The admin marks a reminder draft "sent" after sending it from their own mail app. That
// note lives on the assistant's own draft record (never on the quote), and is what keeps
// the next reminder from going out too soon, or twice in a row with the same tone.

export interface ReminderHistoryEntry {
  count: number
  /** ISO date of the latest reminder marked as sent. */
  lastAt: string | null
}

interface DraftLike {
  kind: string
  payload: unknown
  sentAt?: string | null
  sentCount?: number
}

/** Reminders marked as sent, per quote number, from the assistant's e-mail drafts. */
export function reminderHistory(drafts: DraftLike[]): Map<string, ReminderHistoryEntry> {
  const out = new Map<string, ReminderHistoryEntry>()
  for (const d of drafts) {
    if (d.kind !== 'email_reminder') continue
    const numero = (d.payload as { quoteNumero?: unknown } | null)?.quoteNumero
    const count = d.sentCount ?? 0
    if (typeof numero !== 'string' || count <= 0) continue
    const prev = out.get(numero)
    const lastAt = [prev?.lastAt, d.sentAt].filter((x): x is string => Boolean(x)).sort().pop() ?? null
    out.set(numero, { count: (prev?.count ?? 0) + count, lastAt })
  }
  return out
}

/** First reminder polite, second firm, third and later the last call. An expired quote always gets the last one. */
export function suggestTone(count: number, expired: boolean): ReminderTone {
  if (expired || count >= 2) return 'dernier'
  return count === 1 ? 'direct' : 'courtois'
}

/** Below this, a new reminder would feel like pressure. */
export const MIN_DAYS_BETWEEN_REMINDERS = 3

export interface FollowUp {
  numero: string
  clientNom: string
  daysWaiting: number
  reminders: number
  daysSinceReminder: number | null
}

/**
 * Quotes that deserve a reminder today: waiting for at least `minWait` days, and either
 * never reminded or last reminded at least `minGap` days ago. Oldest first.
 */
export function quotesToFollowUp(
  quotes: Pick<PendingQuote, 'numero' | 'clientNom' | 'dateEmission'>[],
  history: Map<string, ReminderHistoryEntry>,
  now: Date,
  opts: { minWait?: number; minGap?: number } = {},
): FollowUp[] {
  const minWait = opts.minWait ?? 7
  const minGap = opts.minGap ?? 7
  return oldestFirst(quotes)
    .map((q) => {
      const h = history.get(q.numero)
      return { numero: q.numero, clientNom: q.clientNom, daysWaiting: daysBetween(q.dateEmission, now), reminders: h?.count ?? 0, daysSinceReminder: h?.lastAt ? daysBetween(h.lastAt, now) : null }
    })
    .filter((f) => f.daysWaiting >= minWait && (f.daysSinceReminder === null || f.daysSinceReminder >= minGap))
}

// ── One place that decides what the next reminder looks like ────────────────────────────
// Used by the assistant's tool and by the quotes pipeline's "prepare the reminder" button,
// so both give the same tone, the same warning and update the same draft.

interface ReminderDraftLike extends DraftLike {
  id: string
  version: number
  status: string
}

export interface ReminderPlan {
  tone: ReminderTone
  payload: ReminderPayload
  /** Set when a reminder was sent very recently: better to wait. */
  warning?: string
  /** An unsent draft for the same quote and tone, to update instead of piling up copies. */
  existing: { id: string; version: number } | null
}

export function planReminder(
  quote: PendingQuote,
  drafts: ReminderDraftLike[],
  opts: { now: Date; adminName: string; siteUrl: string; tone?: ReminderTone },
): ReminderPlan {
  const sent = reminderHistory(drafts).get(quote.numero)
  const expired = expiryOf(quote).getTime() < opts.now.getTime()
  const tone = opts.tone ?? suggestTone(sent?.count ?? 0, expired)
  const sinceLast = sent?.lastAt ? daysBetween(sent.lastAt, opts.now) : null
  const warning = sinceLast !== null && sinceLast < MIN_DAYS_BETWEEN_REMINDERS
    ? `Une relance a déjà été envoyée il y a ${sinceLast} jour${sinceLast > 1 ? 's' : ''} : mieux vaut attendre avant d'en envoyer une autre.`
    : undefined
  const payload = buildReminder(quote, { tone, now: opts.now, adminName: opts.adminName, siteUrl: opts.siteUrl })
  const found = drafts.find((d) => d.kind === 'email_reminder' && d.status === 'draft' && (d.payload as ReminderPayload | null)?.quoteNumero === quote.numero && (d.payload as ReminderPayload | null)?.tone === tone)
  return { tone, payload, warning, existing: found ? { id: found.id, version: found.version } : null }
}
