'use server'

import { randomBytes, createHash } from 'crypto'
import { ObjectId, type WithId } from 'mongodb'
import { after } from 'next/server'
import { headers } from 'next/headers'
import { put } from '@vercel/blob'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import {
  quoteNotificationEmail, quoteClientCopyEmail, quoteAcceptedEmail, testimonialRequestEmail,
  quoteSignedClientEmail, quoteSignedAdminEmail, quoteDeclinedAdminEmail,
} from '@/lib/email-templates'
import { getAdminEmail } from '@/lib/admin-config'
import { requireAdmin } from '@/lib/require-admin'
import { generateQuotePdf } from '@/lib/quote-pdf'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { getClientIp } from '@/lib/client-ip'

const TVA_RATE = 0.18
const VALIDITE_JOURS = 30
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — avoids visual ambiguity when read aloud
const SIGN_TOKEN_BYTES = 32 // 256 bits — the public /devis/signature/[token] link must be unguessable
const MAX_SIGNATURE_DECODED_BYTES = 500 * 1024 // a canvas signature is a few KB; this is a generous cap against abuse
const SIGN_RATE_LIMIT_PER_HOUR = 10
const SUBMIT_RATE_LIMIT_PER_HOUR = 5
const LOOKUP_RATE_LIMIT_PER_HOUR = 20
const SEND_EMAIL_RATE_LIMIT_PER_HOUR = 5
const MAX_ITEMS = 30
const MAX_DESCRIPTION_LENGTH = 5000
const MAX_TEXT_FIELD_LENGTH = 200
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

// A visitor who clicked a broken/stale link had to see the document — this
// builds it as a real file attached to the email instead, so opening it
// never depends on a web page rendering correctly. Never throws: a PDF
// generation hiccup must not stop the underlying email from sending.
async function buildQuoteAttachment(quote: Quote, variant: 'devis' | 'contrat') {
  try {
    const portfolio = await fetchPortfolioSafe('quote-pdf-attachment')
    const personal = portfolio?.personal ?? defaultPersonalInfo
    const content = await generateQuotePdf({ quote, personal, variant, siteUrl: SITE_URL })
    const filename = `${variant === 'contrat' ? 'Contrat' : 'Devis'}-${quote.numero}.pdf`
    return [{ filename, content, contentType: 'application/pdf' }]
  } catch (e) {
    console.error('[buildQuoteAttachment] PDF generation failed:', e)
    return []
  }
}

export interface QuoteItem {
  designation: string
  quantite: number
  prixUnitaireHT: number
}

export interface QuotePayload {
  clientNom: string
  clientSociete?: string
  clientAdresse?: string
  clientEmail?: string
  clientTelephone?: string
  descriptionProjet: string
  items: QuoteItem[]
}

export type QuoteStatus = 'pending' | 'accepted' | 'declined'

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

export type QuoteEventType = 'created' | 'viewed' | 'signed' | 'declined' | 'status_changed'

export interface QuoteEvent {
  type: QuoteEventType
  at: string
  meta?: Record<string, string>
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
  signature?: QuoteSignature
  events: QuoteEvent[]
}

export interface AdminQuote extends Quote {
  id: string
  read: boolean
  createdAt: string
  testimonialRequestedAt?: string
}

interface QuoteRecordSignature {
  name: string
  email: string
  imageUrl: string
  signedAt: Date
  documentHash: string
}

interface QuoteRecordEvent {
  type: QuoteEventType
  at: Date
  meta?: Record<string, string>
}

interface QuoteRecord extends QuotePayload {
  numero: string
  accessCode: string
  signToken: string
  dateEmission: Date
  validiteJours: number
  totalHT: number
  tva: number
  totalTTC: number
  read: boolean
  createdAt: Date
  status?: QuoteStatus
  testimonialRequestedAt?: Date
  signature?: QuoteRecordSignature
  events?: QuoteRecordEvent[]
}

function quotes() {
  return getDb().then((db) => db.collection<QuoteRecord>('quotes'))
}

function generateAccessCode(length = 6): string {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return code
}

async function nextQuoteNumber(): Promise<string> {
  const col = await quotes()
  const year = new Date().getFullYear()
  const count = await col.countDocuments({ numero: { $regex: `^DEV-${year}-` } })
  return `DEV-${year}-${String(count + 1).padStart(3, '0')}`
}

function toQuote(doc: WithId<QuoteRecord>): Quote {
  const { clientNom, clientSociete, clientAdresse, clientEmail, clientTelephone, descriptionProjet, items,
    numero, accessCode, signToken, dateEmission, validiteJours, totalHT, tva, totalTTC, signature, events } = doc
  return {
    clientNom, clientSociete, clientAdresse, clientEmail, clientTelephone, descriptionProjet, items,
    numero, accessCode, signToken, validiteJours, totalHT, tva, totalTTC,
    dateEmission: dateEmission instanceof Date ? dateEmission.toISOString() : dateEmission,
    status: doc.status ?? 'pending',
    signature: signature ? { ...signature, signedAt: signature.signedAt instanceof Date ? signature.signedAt.toISOString() : signature.signedAt } : undefined,
    events: (events ?? []).map((e) => ({ ...e, at: e.at instanceof Date ? e.at.toISOString() : e.at })),
  }
}

// Quotes created before the electronic-signature feature shipped have no
// signToken in MongoDB — backfill one lazily on first read rather than
// requiring a migration script, so every existing quote gets a working
// signing link the moment it's next looked at.
async function withSignToken(col: Awaited<ReturnType<typeof quotes>>, doc: WithId<QuoteRecord>): Promise<WithId<QuoteRecord>> {
  if (doc.signToken) return doc
  const signToken = randomBytes(SIGN_TOKEN_BYTES).toString('base64url')
  await col.updateOne({ _id: doc._id }, { $set: { signToken } })
  doc.signToken = signToken
  return doc
}

// Shared with contact.ts's rate limiter (same TTL-indexed collection); a
// `scope` tag keeps unrelated features from throttling each other.
// createIndex is idempotent, so calling it here too (contact.ts also does)
// is harmless — it just means this file doesn't rely on contact.ts having
// run first to get automatic cleanup of old rate-limit entries.
let rateLimitIndexReady: Promise<void> | null = null
function ensureRateLimitIndex() {
  if (!rateLimitIndexReady) {
    rateLimitIndexReady = getDb()
      .then((db) => db.collection('ratelimits').createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }))
      .then(() => undefined)
      .catch(() => {})
  }
  return rateLimitIndexReady
}

async function checkRateLimit(scope: string, maxPerHour: number): Promise<boolean> {
  // Index setup, the connection and the request headers are three independent
  // awaits; only the count actually has to happen before the decision.
  const [, db, ip] = await Promise.all([ensureRateLimitIndex(), getDb(), getClientIp()])
  const since = new Date(Date.now() - 3600 * 1000)
  const count = await db.collection('ratelimits').countDocuments({ scope, ip, createdAt: { $gte: since } })
  if (count >= maxPerHour) return false
  // Started immediately so concurrent requests still count against the
  // window, but not awaited — nothing downstream reads the result, and the
  // caller shouldn't pay a round trip for bookkeeping.
  void db
    .collection('ratelimits')
    .insertOne({ scope, ip, createdAt: new Date() })
    .catch((e) => console.error('[checkRateLimit] write failed:', e))
  return true
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
  if (!(await checkRateLimit('submit-quote', SUBMIT_RATE_LIMIT_PER_HOUR))) {
    throw new Error('Trop de tentatives. Réessayez plus tard.')
  }

  const col = await quotes()
  const numero = await nextQuoteNumber()
  const accessCode = generateAccessCode()
  const signToken = randomBytes(SIGN_TOKEN_BYTES).toString('base64url')
  const totalHT = payload.items.reduce((sum, it) => sum + it.quantite * it.prixUnitaireHT, 0)
  const tva = Math.round(totalHT * TVA_RATE)
  const totalTTC = totalHT + tva
  const dateEmission = new Date()
  const createdEvent: QuoteRecordEvent = { type: 'created', at: dateEmission }

  const quote: Quote = {
    ...payload,
    numero,
    accessCode,
    signToken,
    dateEmission: dateEmission.toISOString(),
    validiteJours: VALIDITE_JOURS,
    totalHT,
    tva,
    totalTTC,
    status: 'pending',
    events: [{ ...createdEvent, at: createdEvent.at.toISOString() }],
  }

  await col.insertOne({
    ...payload, numero, accessCode, signToken, dateEmission, validiteJours: VALIDITE_JOURS, totalHT, tva, totalTTC,
    read: false, createdAt: new Date(), status: 'pending', events: [createdEvent],
  })

  // Notify the admin (+ send the client their own copy if we already have an
  // email) in the background — a slow/unreachable SMTP server must never
  // delay the devis appearing in the chat.
  after(async () => {
    try {
      const transporter = getTransporter()
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
          from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
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
  const col = await quotes()
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

const DOWNLOAD_PDF_RATE_LIMIT_PER_HOUR = 20

// Server-rendered PDF for the "Télécharger PDF" button in QuoteView — reuses
// the exact same pdf-lib document as the emailed attachment (real text,
// running header, page numbers) instead of the old client-side
// html2canvas-screenshot-sliced-into-pages approach, which cut table rows
// and paragraphs in half at page boundaries.
// Keyed on accessCode (private, ~33^6 keyspace, rate-limited) rather than
// trusting a client-supplied Quote object — accepting arbitrary quote JSON
// from the browser would let anyone render a fake "signed contract" bearing
// the site owner's name and branding.
export async function downloadQuotePdf(accessCode: string): Promise<{ ok: true; filename: string; base64: string } | { ok: false; error: string }> {
  if (typeof accessCode !== 'string') return { ok: false, error: 'Requête invalide.' }
  const code = accessCode.trim().toUpperCase()
  if (code.length < 4) return { ok: false, error: 'Code invalide.' }
  if (!(await checkRateLimit('download-quote-pdf', DOWNLOAD_PDF_RATE_LIMIT_PER_HOUR))) {
    return { ok: false, error: 'Trop de tentatives. Réessayez plus tard.' }
  }
  const col = await quotes()
  const doc = await col.findOne({ accessCode: code })
  if (!doc) return { ok: false, error: 'Devis introuvable.' }

  const quote = toQuote(doc)
  const variant: 'devis' | 'contrat' = quote.status === 'accepted' ? 'contrat' : 'devis'
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
  const col = await quotes()
  const doc = await col.findOne({ $or: [{ numero: ref }, { accessCode: ref }] })
  if (!doc) return { ok: false, message: 'Devis introuvable pour cette référence.' }
  if (doc.clientEmail && doc.clientEmail !== trimmedEmail) {
    return { ok: false, message: 'Un email est déjà enregistré pour ce devis.' }
  }

  await col.updateOne({ _id: doc._id }, { $set: { clientEmail: trimmedEmail } })
  const quote = toQuote(await withSignToken(col, { ...doc, clientEmail: trimmedEmail }))

  after(async () => {
    try {
      const transporter = getTransporter()
      // signToken is guaranteed here — withSignToken() above never returns
      // without one.
      const clientCopy = quoteClientCopyEmail({ ...quote, signToken: quote.signToken! }, await getAdminEmail())
      const attachments = await buildQuoteAttachment(quote, quote.status === 'accepted' ? 'contrat' : 'devis')
      await transporter.sendMail({
        from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
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

const SIGNATURE_DATA_URL_PREFIX = 'data:image/png;base64,'

export interface SignQuoteInput {
  clientName: string
  clientEmail?: string
  signatureDataUrl: string
}

export type SignActionResult =
  | { ok: true; quote: Quote }
  | { ok: false; error: string }

// Canonical snapshot of everything the client actually agreed to — hashed at
// the moment of signing so any later, hypothetical tampering with the stored
// document can be detected. Key order is fixed by construction, so the same
// quote content always produces the same hash.
function computeDocumentHash(doc: QuoteRecord): string {
  const canonical = JSON.stringify({
    numero: doc.numero,
    client: { nom: doc.clientNom, societe: doc.clientSociete ?? '', adresse: doc.clientAdresse ?? '', email: doc.clientEmail ?? '', telephone: doc.clientTelephone ?? '' },
    description: doc.descriptionProjet,
    items: doc.items,
    totalHT: doc.totalHT,
    tva: doc.tva,
    totalTTC: doc.totalTTC,
    dateEmission: doc.dateEmission instanceof Date ? doc.dateEmission.toISOString() : doc.dateEmission,
    validiteJours: doc.validiteJours,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

function isExpired(doc: Pick<QuoteRecord, 'dateEmission' | 'validiteJours'>): boolean {
  const expiry = new Date(doc.dateEmission)
  expiry.setDate(expiry.getDate() + doc.validiteJours)
  return Date.now() > expiry.getTime()
}

// Public: fetch a quote by its long, unguessable signing token — used by the
// /devis/signature/[token] page. Deliberately never matched against
// `accessCode` (short, meant to be typed aloud) or `numero` (sequential,
// guessable) — only this dedicated token, generated once in submitQuote()
// and never exposed to search engines (the page is noindex).
export async function getQuoteByToken(token: string): Promise<Quote | null> {
  if (typeof token !== 'string' || token.length < 20) return null
  const col = await quotes()
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

// Finalizes a client's electronic signature. Once this succeeds, the quote
// is legally locked: updateQuoteStatus() above refuses to touch a quote that
// has a `signature`, and no code path in this file ever clears one. Any
// later change requires a new quote (a fresh numero), never an edit to this
// one — that immutability is what makes the signed PDF trustworthy.
export async function signQuote(token: string, input: SignQuoteInput): Promise<SignActionResult> {
  if (typeof token !== 'string' || token.length < 20) return { ok: false, error: 'Lien invalide.' }

  const clientName = input.clientName?.trim()
  if (!clientName || clientName.length < 2 || clientName.length > 100) {
    return { ok: false, error: 'Nom complet requis.' }
  }
  if (input.clientEmail && (!EMAIL_RE.test(input.clientEmail) || input.clientEmail.length > 254)) {
    return { ok: false, error: 'Adresse email invalide.' }
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

  const col = await quotes()
  const doc = await col.findOne({ signToken: token })
  if (!doc) return { ok: false, error: 'Devis introuvable.' }
  if (doc.signature) return { ok: false, error: 'Ce devis a déjà été signé.' }
  if (doc.status === 'declined') return { ok: false, error: 'Ce devis a été refusé.' }
  if (isExpired(doc)) return { ok: false, error: 'Ce devis a expiré.' }

  const clientEmail = input.clientEmail?.trim() || doc.clientEmail
  if (!clientEmail) return { ok: false, error: 'Adresse email requise.' }

  let imageUrl: string
  try {
    const buffer = Buffer.from(base64, 'base64')
    const blob = await put(`signatures/${doc._id.toString()}-${Date.now()}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: true,
    })
    imageUrl = blob.url
  } catch (e) {
    console.error('[signQuote] blob upload error:', e)
    return { ok: false, error: "Erreur lors de l'enregistrement de la signature." }
  }

  const signedAt = new Date()
  const documentHash = computeDocumentHash(doc)
  const ip = await getClientIp()
  const userAgent = (await headers()).get('user-agent') ?? undefined

  const signature: QuoteRecordSignature = { name: clientName, email: clientEmail, imageUrl, signedAt, documentHash }
  const signedEvent: QuoteRecordEvent = { type: 'signed', at: signedAt, meta: { ip, ...(userAgent ? { userAgent } : {}) } }

  // Atomic compare-and-set: the filter re-checks `signature` still doesn't
  // exist at write time, so two concurrent signing requests for the same
  // quote (e.g. a double click, or two tabs) can never both succeed — the
  // loser simply gets matchedCount 0 below.
  const result = await col.updateOne(
    { _id: doc._id, signature: { $exists: false }, status: 'pending' },
    { $set: { status: 'accepted', signature, clientEmail }, $push: { events: signedEvent } },
  )
  if (result.matchedCount === 0) return { ok: false, error: 'Ce devis a déjà été signé ou refusé.' }

  const updatedDoc = await col.findOne({ _id: doc._id })
  const quote = toQuote(updatedDoc!)

  after(async () => {
    try {
      const transporter = getTransporter()
      const adminEmail = await getAdminEmail()
      const attachments = await buildQuoteAttachment(quote, 'contrat')
      const clientMail = quoteSignedClientEmail(quote, adminEmail)
      const adminMail = quoteSignedAdminEmail(quote)
      await Promise.all([
        transporter.sendMail({ from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`, to: clientEmail, subject: clientMail.subject, html: clientMail.html, attachments }),
        transporter.sendMail({ from: `"Portfolio NS · Devis" <${process.env.GMAIL_USER}>`, to: adminEmail, subject: adminMail.subject, html: adminMail.html, attachments }),
      ])
    } catch (e) {
      console.error('[signQuote] email error:', e)
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

  const col = await quotes()
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
      const transporter = getTransporter()
      const adminMail = quoteDeclinedAdminEmail(quote)
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
  const col = await quotes()
  const docs = await col.find({}).sort({ createdAt: -1 }).limit(200).toArray()
  return Promise.all(docs.map(async (doc) => ({
    ...toQuote(await withSignToken(col, doc)),
    id: doc._id.toString(),
    read: doc.read ?? false,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    testimonialRequestedAt: doc.testimonialRequestedAt instanceof Date ? doc.testimonialRequestedAt.toISOString() : undefined,
  })))
}

export async function markQuoteRead(id: string): Promise<void> {
  await requireAdmin()
  const col = await quotes()
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { read: true } })
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
  await requireAdmin()
  const col = await quotes()
  const doc = await col.findOne({ _id: new ObjectId(id) })
  // A quote the client has electronically signed is legally locked — the
  // admin can no longer flip its status by hand (see signQuote()'s docblock).
  if (doc?.signature) throw new Error('Ce devis a été signé électroniquement et ne peut plus être modifié.')

  const event: QuoteRecordEvent = { type: 'status_changed', at: new Date(), meta: { to: status } }
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { status }, $push: { events: event } })

  // Contract confirmation fires once, only on the actual pending/declined →
  // accepted transition — never on a no-op re-save of an already-accepted quote.
  if (doc && status === 'accepted' && (doc.status ?? 'pending') !== 'accepted' && doc.clientEmail) {
    const quote = toQuote({ ...doc, status })
    after(async () => {
      try {
        const transporter = getTransporter()
        const adminEmail = await getAdminEmail()
        const attachments = await buildQuoteAttachment(quote, 'contrat')
        const email = quoteAcceptedEmail(quote, adminEmail)
        await transporter.sendMail({
          from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
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
}

// Manually triggered by the admin (after actually delivering the project —
// not automatically on acceptance, which would be premature) but the email
// itself is fully automated: no need to write it by hand each time.
export async function requestTestimonial(id: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin()
  const col = await quotes()
  const doc = await col.findOne({ _id: new ObjectId(id) })
  if (!doc) return { ok: false, message: 'Devis introuvable.' }
  if (!doc.clientEmail) return { ok: false, message: "Ce devis n'a pas d'email client enregistré." }

  try {
    const transporter = getTransporter()
    const adminEmail = await getAdminEmail()
    const email = testimonialRequestEmail({ clientNom: doc.clientNom, numero: doc.numero }, adminEmail)
    await transporter.sendMail({
      from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
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

export async function deleteQuote(id: string): Promise<void> {
  await requireAdmin()
  const col = await quotes()
  await col.deleteOne({ _id: new ObjectId(id) })
}
