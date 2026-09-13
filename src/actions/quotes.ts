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

const TVA_RATE = 0.18
const VALIDITE_JOURS = 30
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — avoids visual ambiguity when read aloud
const SIGN_TOKEN_BYTES = 32 // 256 bits — the public /devis/signature/[token] link must be unguessable
const MAX_SIGNATURE_DECODED_BYTES = 500 * 1024 // a canvas signature is a few KB; this is a generous cap against abuse
const SIGN_RATE_LIMIT_PER_HOUR = 10

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
  signToken: string
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

async function getClientIp(): Promise<string> {
  const hdrs = await headers()
  return hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? 'unknown'
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
  await ensureRateLimitIndex()
  const db = await getDb()
  const ip = await getClientIp()
  const since = new Date(Date.now() - 3600 * 1000)
  const count = await db.collection('ratelimits').countDocuments({ scope, ip, createdAt: { $gte: since } })
  if (count >= maxPerHour) return false
  await db.collection('ratelimits').insertOne({ scope, ip, createdAt: new Date() })
  return true
}

export async function submitQuote(payload: QuotePayload): Promise<Quote> {
  if (!payload.clientNom?.trim()) throw new Error('Nom du client requis.')
  if (!payload.items?.length) throw new Error('Au moins une prestation est requise.')

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
      const notification = quoteNotificationEmail(quote)
      await transporter.sendMail({
        from: `"Portfolio NS · Devis" <${process.env.GMAIL_USER}>`,
        to: adminEmail,
        subject: notification.subject,
        html: notification.html,
      })

      if (payload.clientEmail) {
        const clientCopy = quoteClientCopyEmail(quote, adminEmail)
        await transporter.sendMail({
          from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
          to: payload.clientEmail,
          subject: clientCopy.subject,
          html: clientCopy.html,
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
  const ref = reference.trim().toUpperCase()
  if (!ref) return null
  const col = await quotes()
  const doc = await col.findOne({ $or: [{ numero: ref }, { accessCode: ref }] })
  if (!doc) return null
  return toQuote(await withSignToken(col, doc))
}

// Called when a visitor supplies their email *after* the quote was already
// generated without one — records the email and sends them their copy.
export async function sendQuoteEmail(reference: string, email: string): Promise<{ ok: boolean; message: string }> {
  const ref = reference.trim().toUpperCase()
  const col = await quotes()
  const doc = await col.findOne({ $or: [{ numero: ref }, { accessCode: ref }] })
  if (!doc) return { ok: false, message: 'Devis introuvable pour cette référence.' }

  await col.updateOne({ _id: doc._id }, { $set: { clientEmail: email } })
  const quote = toQuote(await withSignToken(col, { ...doc, clientEmail: email }))

  after(async () => {
    try {
      const transporter = getTransporter()
      const clientCopy = quoteClientCopyEmail(quote, await getAdminEmail())
      await transporter.sendMail({
        from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: clientCopy.subject,
        html: clientCopy.html,
      })
    } catch (e) {
      console.error('[sendQuoteEmail] email error:', e)
    }
  })

  return { ok: true, message: 'Le devis a été envoyé par email.' }
}

// ── Electronic signature ─────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
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
  if (!token || token.length < 20) return null
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
  if (!token || token.length < 20) return { ok: false, error: 'Lien invalide.' }

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
      const clientMail = quoteSignedClientEmail(quote, adminEmail)
      const adminMail = quoteSignedAdminEmail(quote)
      await Promise.all([
        transporter.sendMail({ from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`, to: clientEmail, subject: clientMail.subject, html: clientMail.html }),
        transporter.sendMail({ from: `"Portfolio NS · Devis" <${process.env.GMAIL_USER}>`, to: adminEmail, subject: adminMail.subject, html: adminMail.html }),
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
  if (!token || token.length < 20) return { ok: false, error: 'Lien invalide.' }
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
        const email = quoteAcceptedEmail(quote, adminEmail)
        await transporter.sendMail({
          from: `"Nawaf Nemrod SALAMI" <${process.env.GMAIL_USER}>`,
          to: doc.clientEmail,
          subject: email.subject,
          html: email.html,
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
