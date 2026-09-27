'use server'

import { ObjectId, type WithId } from 'mongodb'
import { after } from 'next/server'
import { headers } from 'next/headers'
import { createHash, randomInt, timingSafeEqual } from 'crypto'
import { uploadPublicImage } from '@/lib/blob-upload'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { loggedMailer, sendMailLogged } from '@/lib/mail-safe'
import { quoteNotificationEmail, quoteSignedAdminEmail, quoteDeclinedAdminEmail } from '@/lib/email-templates'
import { quoteClientCopyEmail, quoteAcceptedEmail, testimonialRequestEmail, quoteSignedClientEmail, signatureCodeEmail } from '@/lib/email-client'
import { getAdminEmail } from '@/lib/admin-config'
import { notifyAdmin } from '@/lib/push'
import { requireAdmin } from '@/lib/require-admin'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { getClientIp } from '@/lib/client-ip'
import { computeTotals, resolveTerms, snapshotTerms, wantsAutoDeposit, wantsSignatureOtp, type QuoteTerms } from '@/lib/business'
import { createInvoice, sendInvoiceMail } from '@/lib/invoicing'
import { CURRENT_DOC_VERSION } from '@/lib/quote-document'
import {
  quotesCol, generateAccessCode, generateSignToken, nextQuoteNumber, toQuote, withSignToken, checkRateLimit,
  computeDocumentHash, isExpired, buildQuoteAttachment, cleanBrief, cleanItems,
  EMAIL_RE, MAX_SIGNATURE_DECODED_BYTES, SIGNATURE_DATA_URL_PREFIX,
  type QuoteRecord, type QuoteRecordEvent, type QuoteRecordSignature,
} from '@/lib/quotes-core'

const VALIDITE_JOURS = 30
const SIGN_RATE_LIMIT_PER_HOUR = 10
const SUBMIT_RATE_LIMIT_PER_HOUR = 5
const LOOKUP_RATE_LIMIT_PER_HOUR = 20
const SEND_EMAIL_RATE_LIMIT_PER_HOUR = 5
const DOWNLOAD_PDF_RATE_LIMIT_PER_HOUR = 20
const MAX_ITEMS = 30
const MAX_DESCRIPTION_LENGTH = 5000
const MAX_TEXT_FIELD_LENGTH = 200

export interface QuoteItem {
  designation: string
  quantite: number
  prixUnitaireHT: number
}

// Structured project brief (cahier des charges) — every field optional, all
// free text. Printed under "3. PROJET" and listed as a contractual document.
export interface QuoteBrief {
  objectifs?: string
  publicCible?: string
  fonctionnalites?: string
  contenus?: string
  references?: string
  contraintes?: string
  echeance?: string
}

export interface QuotePayload {
  clientNom: string
  clientSociete?: string
  clientAdresse?: string
  clientEmail?: string
  clientTelephone?: string
  descriptionProjet: string
  items: QuoteItem[]
  brief?: QuoteBrief
  // Language of the site version the client used: their emails and links follow it.
  locale?: 'fr' | 'en'
}

export type QuoteStatus = 'pending' | 'accepted' | 'declined'

// 'avenant' = a complementary quote amending an already-signed contract
// (extra scope, extra price, extra delay). Same lifecycle as a devis.
export type QuoteKind = 'devis' | 'avenant'

// A signature is only ever written once, server-side, by signQuote() below —
// its presence on a quote is what makes that quote legally locked (see
// updateQuoteStatus's guard further down).
export interface QuoteSignature {
  name: string
  email: string
  imageUrl: string
  signedAt: string
  documentHash: string
}

export type QuoteEventType =
  | 'created' | 'viewed' | 'signed' | 'declined' | 'status_changed'
  | 'delay_changed' | 'delivered' | 'delivery_accepted' | 'avenant_created' | 'invoice_issued' | 'invoice_paid' | 'invoice_cancelled' | 'reminder_sent' | 'delivery_deemed' | 'revision_requested' | 'file_uploaded'

export interface QuoteEvent {
  type: QuoteEventType
  at: string
  meta?: Record<string, string>
}

// Delivery of the finished work — opens the recette period and unlocks the
// balance invoice.
export interface QuoteDelivery {
  deliveredAt: string
  note?: string
  liveUrl?: string
}

// The client's signed procès-verbal de recette.
export interface QuoteAcceptance extends QuoteSignature {
  reserves?: string
}

export interface Quote extends QuotePayload {
  numero: string
  accessCode: string
  // Absent when this quote was returned by a public lookup keyed on the
  // guessable `numero` rather than the private `accessCode` — see
  // lookupQuote()'s docblock in src/actions/quotes.ts.
  signToken?: string
  dateEmission: string
  validiteJours: number
  totalHT: number
  tva: number
  totalTTC: number
  status: QuoteStatus
  kind: QuoteKind
  // For an avenant: the numero of the signed contract it amends, and the
  // working days it adds to that contract's delivery delay.
  parentNumero?: string
  extraDelayDays?: number
  // Version of the legal wording this quote was issued under (see
  // CURRENT_DOC_VERSION in lib/quote-document.ts). Absent = version 1.
  docVersion?: number
  // Commercial terms + provider identity frozen when the quote was issued.
  // Absent on quotes that predate them (see resolveTerms in lib/business).
  terms?: QuoteTerms
  signature?: QuoteSignature
  delivery?: QuoteDelivery
  acceptance?: QuoteAcceptance
  events: QuoteEvent[]
}

export interface AdminQuote extends Quote {
  id: string
  // Token of the PV signing page, once the project has been delivered.
  deliveryToken?: string
  read: boolean
  createdAt: string
  testimonialRequestedAt?: string
  revisions: { at: string; note: string; source: 'client' | 'admin' }[]
  files: { name: string; url: string; size: number; at: string }[]
}

export async function submitQuote(payload: QuotePayload): Promise<Quote> {
  if (!payload.clientNom?.trim()) throw new Error('Nom du client requis.')
  if (!payload.items?.length) throw new Error('Au moins une prestation est requise.')
  if (payload.items.length > MAX_ITEMS) throw new Error('Trop de prestations.')
  if (payload.clientEmail?.trim() && !EMAIL_RE.test(payload.clientEmail.trim())) {
    throw new Error('Adresse email invalide.')
  }
  for (const field of [payload.clientNom, payload.clientSociete, payload.clientAdresse, payload.clientTelephone]) {
    if (field && field.length > MAX_TEXT_FIELD_LENGTH) throw new Error('Champ trop long.')
  }
  if (payload.descriptionProjet && payload.descriptionProjet.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error('Description trop longue.')
  }
  const items = cleanItems(payload.items)
  const brief = cleanBrief(payload.brief)
  if (!(await checkRateLimit('submit-quote', SUBMIT_RATE_LIMIT_PER_HOUR))) {
    throw new Error('Trop de tentatives. Réessayez plus tard.')
  }

  const col = await quotesCol()
  const portfolio = await fetchPortfolioSafe('submitQuote')
  const terms = snapshotTerms(portfolio?.personal ?? defaultPersonalInfo)
  const numero = await nextQuoteNumber('devis')
  const accessCode = generateAccessCode()
  const signToken = generateSignToken()
  const { totalHT, tva, totalTTC } = computeTotals(items, terms)
  const dateEmission = new Date()
  const createdEvent: QuoteRecordEvent = { type: 'created', at: dateEmission }

  const { brief: _rawBrief, ...rest } = payload
  const stored: QuotePayload = { ...rest, items, locale: payload.locale === 'en' ? 'en' : 'fr', ...(brief ? { brief } : {}) }

  const quote: Quote = {
    ...stored,
    numero,
    accessCode,
    signToken,
    dateEmission: dateEmission.toISOString(),
    validiteJours: VALIDITE_JOURS,
    totalHT,
    tva,
    totalTTC,
    status: 'pending',
    kind: 'devis',
    terms,
    docVersion: CURRENT_DOC_VERSION,
    events: [{ ...createdEvent, at: createdEvent.at.toISOString() }],
  }

  const { insertedId } = await col.insertOne({
    ...stored, numero, accessCode, signToken, dateEmission, validiteJours: VALIDITE_JOURS, totalHT, tva, totalTTC,
    read: false, createdAt: new Date(), status: 'pending', kind: 'devis', terms, docVersion: CURRENT_DOC_VERSION, events: [createdEvent],
  })

  // Notify the admin (+ send the client their own copy if we already have an
  // email) in the background — a slow/unreachable SMTP server must never
  // delay the devis appearing in the chat.
  after(() => notifyAdmin({ title: `Nouveau devis ${quote.numero}`, body: `${quote.clientNom} — ${quote.totalTTC.toLocaleString('fr-FR')} FCFA TTC`, url: '/admin/quotes' }))
  after(async () => {
    try {
      const transporter = loggedMailer({ kind: 'devis', quoteId: insertedId.toString() })
      const adminEmail = await getAdminEmail()
      const attachments = await buildQuoteAttachment(quote, 'devis')
      const notification = quoteNotificationEmail(quote)
      await transporter.sendMail({
        from: `"Portfolio NS · Devis" <${process.env.GMAIL_USER}>`,
        to: adminEmail,
        subject: notification.subject,
        html: notification.html,
        attachments,
      })

      if (payload.clientEmail) {
        // signToken is always freshly generated a few lines above — the
        // Quote type only marks it optional for lookupQuote()'s reduced
        // public projection (see its docblock).
        const clientCopy = quoteClientCopyEmail({ ...quote, signToken: quote.signToken! }, adminEmail)
        await transporter.sendMail({
          from: `"${terms.provider.name}" <${process.env.GMAIL_USER}>`,
          to: payload.clientEmail,
          subject: clientCopy.subject,
          html: clientCopy.html,
          attachments,
        })
      }
    } catch (e) {
      console.error('[submitQuote] email error:', e)
    }
  })

  return quote
}

// Retrieve a previously generated quote by its number (DEV-2026-002) or its
// short access code, so a visitor can find it again without redoing the chat.
export async function lookupQuote(reference: string): Promise<Quote | null> {
  if (typeof reference !== 'string') return null
  const ref = reference.trim().toUpperCase()
  if (!ref) return null
  if (!(await checkRateLimit('lookup-quote', LOOKUP_RATE_LIMIT_PER_HOUR))) return null
  const col = await quotesCol()
  const doc = await col.findOne({ $or: [{ numero: ref }, { accessCode: ref }] })
  if (!doc) return null
  const quote = toQuote(doc)
  // signToken grants full read+sign access to the quote — only hand it back
  // when the visitor proved they know the random accessCode (given to the
  // client privately, ~33^6 keyspace, rate-limited). `numero` is sequential
  // and guessable (DEV-2026-001, -002, …), so a lookup by numero alone must
  // never return it — otherwise anyone could enumerate numeros and sign
  // other clients' contracts. See getQuoteByToken()'s docblock.
  if (doc.accessCode !== ref) delete quote.signToken
  return quote
}

// Server-rendered PDF for the "Télécharger PDF" button in QuoteView — reuses
// the exact same pdf-lib document as the emailed attachment (real text,
// running header, page numbers) instead of the old client-side
// html2canvas-screenshot-sliced-into-pages approach, which cut table rows
// and paragraphs in half at page boundaries.
// Keyed on accessCode (private, ~33^6 keyspace, rate-limited) rather than
// trusting a client-supplied Quote object — accepting arbitrary quote JSON
// from the browser would let anyone render a fake "signed contract" bearing
// the site owner's name and branding.
// `document: 'pv'` returns the delivery report instead of the devis/contract.
export async function downloadQuotePdf(
  accessCode: string,
  document: 'auto' | 'pv' = 'auto',
): Promise<{ ok: true; filename: string; base64: string } | { ok: false; error: string }> {
  if (typeof accessCode !== 'string') return { ok: false, error: 'Requête invalide.' }
  const code = accessCode.trim().toUpperCase()
  if (code.length < 4) return { ok: false, error: 'Code invalide.' }
  if (!(await checkRateLimit('download-quote-pdf', DOWNLOAD_PDF_RATE_LIMIT_PER_HOUR))) {
    return { ok: false, error: 'Trop de tentatives. Réessayez plus tard.' }
  }
  const col = await quotesCol()
  const doc = await col.findOne({ accessCode: code })
  if (!doc) return { ok: false, error: 'Devis introuvable.' }

  const quote = toQuote(doc)
  if (document === 'pv' && !quote.delivery) return { ok: false, error: "Ce projet n'a pas encore été livré." }
  const variant = document === 'pv' ? 'pv' : quote.status === 'accepted' ? 'contrat' : 'devis'
  const attachments = await buildQuoteAttachment(quote, variant)
  if (!attachments.length) return { ok: false, error: 'Erreur lors de la génération du PDF.' }
  return { ok: true, filename: attachments[0].filename, base64: attachments[0].content.toString('base64') }
}

// Called when a visitor supplies their email *after* the quote was already
// generated without one — records the email and sends them their copy.
// Deliberately refuses to overwrite an already-recorded clientEmail: doing so
// would let anyone who guesses a quote reference (numero is sequential)
// redirect that client's future contract/signature emails to themselves.
export async function sendQuoteEmail(reference: string, email: string): Promise<{ ok: boolean; message: string }> {
  if (typeof reference !== 'string' || typeof email !== 'string') {
    return { ok: false, message: 'Requête invalide.' }
  }
  const trimmedEmail = email.trim()
  if (!EMAIL_RE.test(trimmedEmail) || trimmedEmail.length > 254) {
    return { ok: false, message: 'Adresse email invalide.' }
  }
  if (!(await checkRateLimit('send-quote-email', SEND_EMAIL_RATE_LIMIT_PER_HOUR))) {
    return { ok: false, message: 'Trop de tentatives. Réessayez plus tard.' }
  }
  const ref = reference.trim().toUpperCase()
  const col = await quotesCol()
  const doc = await col.findOne({ $or: [{ numero: ref }, { accessCode: ref }] })
  if (!doc) return { ok: false, message: 'Devis introuvable pour cette référence.' }
  if (doc.clientEmail && doc.clientEmail !== trimmedEmail) {
    return { ok: false, message: 'Un email est déjà enregistré pour ce devis.' }
  }

  await col.updateOne({ _id: doc._id }, { $set: { clientEmail: trimmedEmail } })
  const quote = toQuote(await withSignToken(col, { ...doc, clientEmail: trimmedEmail }))

  after(async () => {
    try {
      const transporter = loggedMailer({ kind: quote.status === 'accepted' ? 'contrat' : 'devis', quoteId: doc._id.toString() })
      // signToken is guaranteed here — withSignToken() above never returns
      // without one.
      const clientCopy = quoteClientCopyEmail({ ...quote, signToken: quote.signToken! }, await getAdminEmail())
      const attachments = await buildQuoteAttachment(quote, quote.status === 'accepted' ? 'contrat' : 'devis')
      await transporter.sendMail({
        from: `"${quote.terms?.provider.name ?? defaultPersonalInfo.name}" <${process.env.GMAIL_USER}>`,
        to: trimmedEmail,
        subject: clientCopy.subject,
        html: clientCopy.html,
        attachments,
      })
    } catch (e) {
      console.error('[sendQuoteEmail] email error:', e)
    }
  })

  return { ok: true, message: 'Le devis a été envoyé par email.' }
}

// ── Electronic signature ─────────────────────────────────────────────────────

export interface SignQuoteInput {
  clientName: string
  clientEmail?: string
  signatureDataUrl: string
  // The signer ticked "I have read the conditions and I am authorised to bind
  // myself / the company I represent" — required, and recorded in the audit
  // trail next to the IP, so a company can't later say the signer had no
  // authority without that statement being on record.
  acceptedTerms: boolean
  // The 6-digit code emailed by requestSignatureCode(); required unless the
  // quote's terms switch the confirmation off.
  otp?: string
}

export type SignActionResult =
  | { ok: true; quote: Quote }
  | { ok: false; error: string }

// Public: fetch a quote by its long, unguessable signing token — used by the
// /devis/signature/[token] page. Deliberately never matched against
// `accessCode` (short, meant to be typed aloud) or `numero` (sequential,
// guessable) — only this dedicated token, generated once in submitQuote()
// and never exposed to search engines (the page is noindex).
export async function getQuoteByToken(token: string): Promise<Quote | null> {
  if (typeof token !== 'string' || token.length < 20) return null
  const col = await quotesCol()
  // Matched by signToken alone — a doc found this way already has one, so
  // no backfill is needed (unlike lookupQuote/listQuotes, reached by
  // numero/accessCode, which can still hit pre-signature-feature records).
  const doc = await col.findOne({ signToken: token })
  if (!doc) return null

  // Log the first view only — avoids flooding the audit trail on every reload.
  if (!(doc.events ?? []).some((e) => e.type === 'viewed')) {
    const event: QuoteRecordEvent = { type: 'viewed', at: new Date() }
    await col.updateOne({ _id: doc._id }, { $push: { events: event } })
    doc.events = [...(doc.events ?? []), event]
  }

  return toQuote(doc)
}

// ── Signature code (email confirmation) ─────────────────────────────────────

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_RESEND_MIN_MS = 30 * 1000
const OTP_MAX_SENDS_PER_HOUR = 5
const OTP_MAX_ATTEMPTS = 5
const SIGN_CODE_RATE_LIMIT_PER_HOUR = 15

const hashCode = (code: string, token: string) => createHash('sha256').update(`${code}:${token}`).digest('hex')

function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(6, name.length - 1)))}@${domain}`
}

// Emails a one-time code the client must type to sign. Proves that whoever
// signs controls the mailbox the quote was issued to — the audit trail records
// it next to the IP. The code goes to the email already on the quote; it is
// only taken from the client when the quote has none yet.
export async function requestSignatureCode(token: string, email?: string): Promise<{ ok: true; sentTo: string } | { ok: false; error: string }> {
  if (typeof token !== 'string' || token.length < 20) return { ok: false, error: 'Lien invalide.' }
  if (!(await checkRateLimit('sign-code', SIGN_CODE_RATE_LIMIT_PER_HOUR))) return { ok: false, error: 'Trop de tentatives. Réessayez plus tard.' }

  const col = await quotesCol()
  const doc = await col.findOne({ signToken: token })
  if (!doc) return { ok: false, error: 'Devis introuvable.' }
  if (doc.signature) return { ok: false, error: 'Ce devis a déjà été signé.' }
  if (doc.status === 'declined') return { ok: false, error: 'Ce devis a été refusé.' }
  if (isExpired(doc)) return { ok: false, error: 'Ce devis a expiré.' }
  if (!wantsSignatureOtp(resolveTerms(doc, defaultPersonalInfo))) return { ok: false, error: "Aucun code n'est requis pour ce devis." }

  const target = (doc.clientEmail || email || '').trim()
  if (!EMAIL_RE.test(target) || target.length > 254) return { ok: false, error: 'Adresse email invalide.' }

  const now = Date.now()
  const previous = doc.signOtp
  if (previous && now - previous.sentAt.getTime() < OTP_RESEND_MIN_MS) {
    return { ok: false, error: 'Patientez quelques secondes avant de demander un nouveau code.' }
  }
  const inWindow = !!previous && now - previous.windowStart.getTime() < 3600_000
  if (previous && inWindow && previous.sendCount >= OTP_MAX_SENDS_PER_HOUR) {
    return { ok: false, error: 'Trop de codes demandés. Réessayez dans une heure.' }
  }

  const code = String(randomInt(100000, 1000000))
  await col.updateOne({ _id: doc._id, signature: { $exists: false } }, {
    $set: {
      signOtp: {
        hash: hashCode(code, token), email: target, expiresAt: new Date(now + OTP_TTL_MS), attempts: 0,
        sentAt: new Date(now), windowStart: previous && inWindow ? previous.windowStart : new Date(now), sendCount: previous && inWindow ? previous.sendCount + 1 : 1,
      },
    },
  })

  const mail = signatureCodeEmail({ numero: doc.numero, code, clientNom: doc.clientNom, kind: doc.kind ?? 'devis', locale: doc.locale })
  const sent = await sendMailLogged(
    { from: `"${doc.terms?.provider.name ?? defaultPersonalInfo.name}" <${process.env.GMAIL_USER}>`, to: target, subject: mail.subject, html: mail.html },
    { kind: 'devis', quoteId: doc._id.toString() },
    { record: false },
  )
  if (!sent) return { ok: false, error: "Impossible d'envoyer le code. Vérifiez l'adresse email et réessayez." }
  return { ok: true, sentTo: maskEmail(target) }
}

// Checks the code the client typed. Every try is counted atomically (5 max
// per code), and a code only lives 10 minutes.
async function verifySignatureCode(
  col: Awaited<ReturnType<typeof quotesCol>>,
  doc: WithId<QuoteRecord>,
  token: string,
  code: string | undefined,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const otp = doc.signOtp
  if (!code || !/^\d{6}$/.test(code.trim())) return { ok: false, error: 'Saisissez le code à 6 chiffres reçu par email.' }
  if (!otp) return { ok: false, error: "Demandez d'abord un code par email." }
  if (Date.now() > otp.expiresAt.getTime()) return { ok: false, error: 'Ce code a expiré. Demandez-en un nouveau.' }

  const counted = await col.updateOne({ _id: doc._id, 'signOtp.attempts': { $lt: OTP_MAX_ATTEMPTS } }, { $inc: { 'signOtp.attempts': 1 } })
  if (counted.matchedCount === 0) return { ok: false, error: 'Trop d’essais. Demandez un nouveau code.' }

  const expected = Buffer.from(otp.hash, 'hex')
  const given = Buffer.from(hashCode(code.trim(), token), 'hex')
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, error: 'Code incorrect.' }
  return { ok: true, email: otp.email }
}

// Finalizes a client's electronic signature. Once this succeeds, the quote
// is legally locked: updateQuoteStatus() above refuses to touch a quote that
// has a `signature`, and no code path in this file ever clears one. Any
// later change requires a new quote (a fresh numero) or an avenant, never an
// edit to this one — that immutability is what makes the signed PDF
// trustworthy.
export async function signQuote(token: string, input: SignQuoteInput): Promise<SignActionResult> {
  if (typeof token !== 'string' || token.length < 20) return { ok: false, error: 'Lien invalide.' }

  const clientName = input.clientName?.trim()
  if (!clientName || clientName.length < 2 || clientName.length > 100) {
    return { ok: false, error: 'Nom complet requis.' }
  }
  if (input.clientEmail && (!EMAIL_RE.test(input.clientEmail) || input.clientEmail.length > 254)) {
    return { ok: false, error: 'Adresse email invalide.' }
  }
  if (input.acceptedTerms !== true) {
    return { ok: false, error: 'Vous devez confirmer avoir pris connaissance des conditions et être habilité à signer.' }
  }
  if (typeof input.signatureDataUrl !== 'string' || !input.signatureDataUrl.startsWith(SIGNATURE_DATA_URL_PREFIX)) {
    return { ok: false, error: 'Signature invalide.' }
  }
  const base64 = input.signatureDataUrl.slice(SIGNATURE_DATA_URL_PREFIX.length)
  // Rough decoded-size check before ever allocating a Buffer — base64 runs ~4/3 the decoded size.
  if (base64.length * 0.75 > MAX_SIGNATURE_DECODED_BYTES) {
    return { ok: false, error: 'Signature trop volumineuse.' }
  }

  if (!(await checkRateLimit('sign-quote', SIGN_RATE_LIMIT_PER_HOUR))) {
    return { ok: false, error: 'Trop de tentatives. Réessayez plus tard.' }
  }

  const col = await quotesCol()
  const doc = await col.findOne({ signToken: token })
  if (!doc) return { ok: false, error: 'Devis introuvable.' }
  if (doc.signature) return { ok: false, error: 'Ce devis a déjà été signé.' }
  if (doc.status === 'declined') return { ok: false, error: 'Ce devis a été refusé.' }
  if (isExpired(doc)) return { ok: false, error: 'Ce devis a expiré.' }

  const terms = resolveTerms(doc, defaultPersonalInfo)
  let clientEmail = input.clientEmail?.trim() || doc.clientEmail
  let otpVerified = false
  if (wantsSignatureOtp(terms)) {
    const check = await verifySignatureCode(col, doc, token, input.otp)
    if (!check.ok) return { ok: false, error: check.error }
    // The address that received the code is the signer's address.
    clientEmail = check.email
    otpVerified = true
  }
  if (!clientEmail) return { ok: false, error: 'Adresse email requise.' }

  let imageUrl: string
  try {
    imageUrl = await uploadPublicImage(`signatures/${doc._id.toString()}-${Date.now()}.png`, Buffer.from(base64, 'base64'))
  } catch (e) {
    console.error('[signQuote] blob upload error:', e)
    return { ok: false, error: "Erreur lors de l'enregistrement de la signature." }
  }

  const signedAt = new Date()
  const documentHash = computeDocumentHash(doc)
  const ip = await getClientIp()
  const userAgent = (await headers()).get('user-agent') ?? undefined

  const signature: QuoteRecordSignature = { name: clientName, email: clientEmail, imageUrl, signedAt, documentHash }
  const signedEvent: QuoteRecordEvent = {
    type: 'signed',
    at: signedAt,
    meta: { ip, authority: 'confirmed', ...(otpVerified ? { otp: 'verified' } : {}), ...(userAgent ? { userAgent } : {}) },
  }

  // Atomic compare-and-set: the filter re-checks `signature` still doesn't
  // exist at write time, so two concurrent signing requests for the same
  // quote (e.g. a double click, or two tabs) can never both succeed — the
  // loser simply gets matchedCount 0 below.
  const result = await col.updateOne(
    { _id: doc._id, signature: { $exists: false }, status: 'pending' },
    { $set: { status: 'accepted', signature, clientEmail }, $unset: { signOtp: '' }, $push: { events: signedEvent } },
  )
  if (result.matchedCount === 0) return { ok: false, error: 'Ce devis a déjà été signé ou refusé.' }

  const updatedDoc = await col.findOne({ _id: doc._id })
  const quote = toQuote(updatedDoc!)

  after(() => notifyAdmin({ title: `${quote.numero} signé ✍️`, body: `${clientName} a signé ${quote.kind === 'avenant' ? "l'avenant" : 'le devis'}.`, url: '/admin/quotes' }))
  after(async () => {
    try {
      const transporter = loggedMailer({ kind: 'contrat', quoteId: doc._id.toString() })
      const adminEmail = await getAdminEmail()
      const attachments = await buildQuoteAttachment(quote, 'contrat')
      const clientMail = quoteSignedClientEmail(quote, adminEmail)
      const adminMail = quoteSignedAdminEmail(quote)
      await Promise.all([
        transporter.sendMail({ from: `"${quote.terms?.provider.name ?? defaultPersonalInfo.name}" <${process.env.GMAIL_USER}>`, to: clientEmail, subject: clientMail.subject, html: clientMail.html, attachments }),
        transporter.sendMail({ from: `"Portfolio NS · Devis" <${process.env.GMAIL_USER}>`, to: adminEmail, subject: adminMail.subject, html: adminMail.html, attachments }),
      ])
    } catch (e) {
      console.error('[signQuote] email error:', e)
    }

    // Deposit invoice straight away, when the provider asked for it: the
    // project starts once it is paid, so there is no reason to wait for a
    // manual step. Same rules and same email as the manual button.
    if (wantsAutoDeposit(terms)) {
      try {
        const issued = await createInvoice(doc._id.toString(), 'acompte')
        if (issued.ok && issued.invoice) await sendInvoiceMail(issued.invoice, 'facture')
      } catch (e) {
        console.error('[signQuote] auto deposit invoice error:', e)
      }
    }
  })

  return { ok: true, quote }
}

// Client-initiated refusal — always allowed unless the quote is already
// signed (then it's locked) or already declined (no-op guard against a
// double click / replayed request).
export async function declineQuote(token: string): Promise<SignActionResult> {
  if (typeof token !== 'string' || token.length < 20) return { ok: false, error: 'Lien invalide.' }
  if (!(await checkRateLimit('sign-quote', SIGN_RATE_LIMIT_PER_HOUR))) {
    return { ok: false, error: 'Trop de tentatives. Réessayez plus tard.' }
  }

  const col = await quotesCol()
  const doc = await col.findOne({ signToken: token })
  if (!doc) return { ok: false, error: 'Devis introuvable.' }
  if (doc.signature) return { ok: false, error: 'Ce devis a déjà été signé et ne peut plus être refusé.' }
  if (doc.status === 'declined') return { ok: false, error: 'Ce devis a déjà été refusé.' }

  const event: QuoteRecordEvent = { type: 'declined', at: new Date() }
  const result = await col.updateOne(
    { _id: doc._id, signature: { $exists: false }, status: 'pending' },
    { $set: { status: 'declined' }, $push: { events: event } },
  )
  if (result.matchedCount === 0) return { ok: false, error: 'Action impossible.' }

  const updatedDoc = await col.findOne({ _id: doc._id })
  const quote = toQuote(updatedDoc!)

  after(async () => {
    try {
      const transporter = loggedMailer({ kind: 'admin', quoteId: doc._id.toString() })
      const adminMail = quoteDeclinedAdminEmail(quote)
      await notifyAdmin({ title: `${quote.numero} refusé`, body: `${quote.clientNom} a refusé le devis.`, url: '/admin/quotes' })
      await transporter.sendMail({ from: `"Portfolio NS · Devis" <${process.env.GMAIL_USER}>`, to: await getAdminEmail(), subject: adminMail.subject, html: adminMail.html })
    } catch (e) {
      console.error('[declineQuote] email error:', e)
    }
  })

  return { ok: true, quote }
}

// ── Admin actions ────────────────────────────────────────────────────────────

export async function listQuotes(): Promise<AdminQuote[]> {
  await requireAdmin()
  const col = await quotesCol()
  const docs = await col.find({}).sort({ createdAt: -1 }).limit(1000).toArray()
  return Promise.all(docs.map(async (rawDoc) => {
    const doc = await withSignToken(col, rawDoc)
    // A delivery recorded before PV links had their own token gets one now.
    if (doc.delivery && !doc.delivery.token) {
      doc.delivery.token = generateSignToken()
      await col.updateOne({ _id: doc._id }, { $set: { 'delivery.token': doc.delivery.token } })
    }
    return {
      ...toQuote(doc),
      id: doc._id.toString(),
      deliveryToken: doc.delivery?.token,
      read: doc.read ?? false,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
      testimonialRequestedAt: doc.testimonialRequestedAt instanceof Date ? doc.testimonialRequestedAt.toISOString() : undefined,
      revisions: (doc.revisions ?? []).map((r) => ({ at: r.at.toISOString(), note: r.note, source: r.source })),
      files: (doc.files ?? []).map((f) => ({ name: f.name, url: f.url, size: f.size, at: f.at.toISOString() })),
    }
  }))
}

export async function markQuoteRead(id: string): Promise<void> {
  await requireAdmin()
  const col = await quotesCol()
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { read: true } })
}

export type AdminActionResult = { ok: true } | { ok: false; message: string }

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<AdminActionResult> {
  await requireAdmin()
  const col = await quotesCol()
  const doc = await col.findOne({ _id: new ObjectId(id) })
  // A quote the client has electronically signed is legally locked — the
  // admin can no longer flip its status by hand (see signQuote()'s docblock).
  if (doc?.signature) return { ok: false, message: 'Ce devis a été signé électroniquement et ne peut plus être modifié.' }

  const event: QuoteRecordEvent = { type: 'status_changed', at: new Date(), meta: { to: status } }
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { status }, $push: { events: event } })

  // Contract confirmation fires once, only on the actual pending/declined →
  // accepted transition — never on a no-op re-save of an already-accepted quote.
  if (doc && status === 'accepted' && (doc.status ?? 'pending') !== 'accepted' && doc.clientEmail) {
    const quote = toQuote({ ...doc, status })
    after(async () => {
      try {
        const transporter = loggedMailer({ kind: 'contrat', quoteId: id })
        const adminEmail = await getAdminEmail()
        const attachments = await buildQuoteAttachment(quote, 'contrat')
        const email = quoteAcceptedEmail(quote, adminEmail)
        await transporter.sendMail({
          from: `"${quote.terms?.provider.name ?? defaultPersonalInfo.name}" <${process.env.GMAIL_USER}>`,
          to: doc.clientEmail,
          subject: email.subject,
          html: email.html,
          attachments,
        })
      } catch (e) {
        console.error('[updateQuoteStatus] contract email error:', e)
      }
    })
  }
  return { ok: true }
}

// Manually triggered by the admin (after actually delivering the project —
// not automatically on acceptance, which would be premature) but the email
// itself is fully automated: no need to write it by hand each time.
export async function requestTestimonial(id: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin()
  const col = await quotesCol()
  const doc = await col.findOne({ _id: new ObjectId(id) })
  if (!doc) return { ok: false, message: 'Devis introuvable.' }
  if (!doc.clientEmail) return { ok: false, message: "Ce devis n'a pas d'email client enregistré." }

  try {
    const transporter = getTransporter()
    const adminEmail = await getAdminEmail()
    const email = testimonialRequestEmail({ accessCode: doc.accessCode, clientNom: doc.clientNom, numero: doc.numero, locale: doc.locale }, adminEmail)
    await transporter.sendMail({
      from: `"${doc.terms?.provider.name ?? defaultPersonalInfo.name}" <${process.env.GMAIL_USER}>`,
      to: doc.clientEmail,
      subject: email.subject,
      html: email.html,
    })
  } catch (e) {
    console.error('[requestTestimonial] email error:', e)
    return { ok: false, message: "Échec de l'envoi de l'email." }
  }

  await col.updateOne({ _id: new ObjectId(id) }, { $set: { testimonialRequestedAt: new Date() } })
  return { ok: true, message: 'Demande envoyée.' }
}

export async function deleteQuote(id: string): Promise<AdminActionResult> {
  await requireAdmin()
  const col = await quotesCol()
  const doc = await col.findOne({ _id: new ObjectId(id) })
  // Invoices are accounting evidence and must stay traceable to their
  // contract — a quote that has any may not simply disappear.
  if (doc) {
    const db = await getDb()
    if (await db.collection('invoices').countDocuments({ quoteNumero: doc.numero })) {
      return { ok: false, message: 'Ce devis a des factures émises et ne peut pas être supprimé.' }
    }
  }
  await col.deleteOne({ _id: new ObjectId(id) })
  return { ok: true }
}
