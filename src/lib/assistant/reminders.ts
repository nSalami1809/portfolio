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

export function viewOf(q: PendingQuote, now: Date): PendingQuoteView {
  const left = Math.ceil((expiryOf(q).getTime() - now.getTime()) / DAY)
  return { numero: q.numero, daysWaiting: daysBetween(q.dateEmission, now), expiresInDays: left, expired: left < 0, totalTTC: q.totalTTC, hasEmail: Boolean(q.clientEmail) }
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

/** A mailto: link that opens the admin's own mail app with the draft filled in. Sends nothing by itself. */
export function mailtoHref(payload: Pick<ReminderPayload, 'to' | 'subject' | 'body'>): string {
  const params = `subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.body)}`
  return `mailto:${encodeURIComponent(payload.to ?? '').replace(/%40/g, '@')}?${params}`
}
