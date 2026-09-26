// Shared internals of the quote lifecycle (devis → contrat → livraison →
// factures). Lives outside 'use server' files on purpose: a 'use server'
// module may only export async functions that become public endpoints, and
// none of what is below (collection handles, hashing, rate limiting, PDF
// attachment building) should ever be callable from a browser.
import { randomBytes } from 'crypto'
import type { Collection, WithId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getClientIp } from '@/lib/client-ip'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { generateQuotePdf } from '@/lib/quote-pdf'
import type { QuoteTerms } from '@/lib/business'
import type { Quote, QuotePayload, QuoteStatus, QuoteEventType, QuoteKind, QuoteBrief, QuoteItem } from '@/actions/quotes'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — avoids visual ambiguity when read aloud
const SIGN_TOKEN_BYTES = 32 // 256 bits — the public /devis/signature/[token] link must be unguessable
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
export const MAX_SIGNATURE_DECODED_BYTES = 500 * 1024 // a canvas signature is a few KB; this is a generous cap against abuse
export const SIGNATURE_DATA_URL_PREFIX = 'data:image/png;base64,'

export interface QuoteRecordSignature {
  name: string
  email: string
  imageUrl: string
  signedAt: Date
  documentHash: string
}

export interface QuoteRecordEvent {
  type: QuoteEventType
  at: Date
  meta?: Record<string, string>
}

export interface QuoteRecordDelivery {
  deliveredAt: Date
  note?: string
  liveUrl?: string
  // Private link token of the procès-verbal page (/recette/[token]) — separate
  // from the quote's signToken so each document has its own link. Deliberately
  // not part of the public Quote projection (see toQuote).
  token: string
}

export interface QuoteRecordAcceptance extends QuoteRecordSignature {
  reserves?: string
}

export interface QuoteRecord extends QuotePayload {
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
  kind?: QuoteKind
  parentNumero?: string
  extraDelayDays?: number
  docVersion?: number
  terms?: QuoteTerms
  delivery?: QuoteRecordDelivery
  acceptance?: QuoteRecordAcceptance
}

const MAX_BRIEF_FIELD_LENGTH = 1000
const MAX_TEXT_FIELD_LENGTH = 200
const MAX_QUANTITY = 99
const MAX_UNIT_PRICE_HT = 1_000_000_000

// The brief and the item list come from a public form / the chatbot, and the
// prices end up in a legal document: validate and normalise them here rather
// than trusting whatever the client sent.
export function cleanBrief(brief: QuoteBrief | undefined): QuoteBrief | undefined {
  if (!brief || typeof brief !== 'object') return undefined
  const out: QuoteBrief = {}
  for (const key of ['objectifs', 'publicCible', 'fonctionnalites', 'contenus', 'references', 'contraintes', 'echeance'] as const) {
    const v = brief[key]
    if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, MAX_BRIEF_FIELD_LENGTH)
  }
  return Object.keys(out).length ? out : undefined
}

export function cleanItems(items: QuoteItem[]): QuoteItem[] {
  return items.map((it) => {
    const designation = typeof it.designation === 'string' ? it.designation.trim() : ''
    const quantite = Math.round(Number(it.quantite))
    const prixUnitaireHT = Math.round(Number(it.prixUnitaireHT))
    if (!designation || designation.length > MAX_TEXT_FIELD_LENGTH) throw new Error('Désignation de prestation invalide.')
    if (!Number.isFinite(quantite) || quantite < 1 || quantite > MAX_QUANTITY) throw new Error('Quantité invalide.')
    if (!Number.isFinite(prixUnitaireHT) || prixUnitaireHT < 0 || prixUnitaireHT > MAX_UNIT_PRICE_HT) throw new Error('Prix invalide.')
    return { designation, quantite, prixUnitaireHT }
  })
}

// Lookups are all by a private code / token / numero — index them so they stay
// instant as the collection grows, and make `numero` unique so a race can never
// hand out the same number twice. Created once per server instance, off the
// request path (createIndex is idempotent; a failure just means "no index yet").
let quoteIndexes: Promise<unknown> | null = null
function ensureQuoteIndexes(col: Collection<QuoteRecord>) {
  if (!quoteIndexes) {
    quoteIndexes = Promise.all([
      col.createIndex({ numero: 1 }, { unique: true }),
      col.createIndex({ accessCode: 1 }),
      col.createIndex({ signToken: 1 }),
      col.createIndex({ 'delivery.token': 1 }, { sparse: true }),
      col.createIndex({ parentNumero: 1 }, { sparse: true }),
      col.createIndex({ createdAt: -1 }),
    ]).catch((e) => console.error('[quotes] index creation failed:', e))
  }
}

export async function quotesCol() {
  const col = (await getDb()).collection<QuoteRecord>('quotes')
  ensureQuoteIndexes(col)
  return col
}

export function generateAccessCode(length = 6): string {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return code
}

export function generateSignToken(): string {
  return randomBytes(SIGN_TOKEN_BYTES).toString('base64url')
}

// DEV-2026-001 for a devis, AVN-2026-001 for an avenant — one counter per
// prefix and year. The counter is bumped atomically (two quotes created at the
// same instant can never share a number) and seeded, the first time, from the
// quotes that already exist.
export async function nextQuoteNumber(kind: QuoteKind = 'devis'): Promise<string> {
  const col = await quotesCol()
  const db = await getDb()
  const year = new Date().getFullYear()
  const prefix = kind === 'avenant' ? 'AVN' : 'DEV'
  const existing = await col.countDocuments({ numero: { $regex: `^${prefix}-${year}-` } })
  const counter = await db.collection<{ _id: string; seq: number }>('counters').findOneAndUpdate(
    { _id: `quote-${prefix}-${year}` },
    [{ $set: { seq: { $add: [{ $ifNull: ['$seq', existing] }, 1] } } }],
    { upsert: true, returnDocument: 'after' },
  )
  return `${prefix}-${year}-${String(counter?.seq ?? existing + 1).padStart(3, '0')}`
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d)

export function toQuote(doc: WithId<QuoteRecord>): Quote {
  const { clientNom, clientSociete, clientAdresse, clientEmail, clientTelephone, descriptionProjet, items, brief, locale,
    numero, accessCode, signToken, dateEmission, validiteJours, totalHT, tva, totalTTC, signature, events,
    parentNumero, extraDelayDays, docVersion, terms, delivery, acceptance } = doc
  return {
    clientNom, clientSociete, clientAdresse, clientEmail, clientTelephone, descriptionProjet, items, brief, locale,
    numero, accessCode, signToken, validiteJours, totalHT, tva, totalTTC, parentNumero, extraDelayDays, docVersion,
    // Payment coordinates (an Airtel/IBAN number) belong on invoices, not in a
    // quote payload that lookupQuote() serves by its guessable numero.
    terms: terms ? { ...terms, paymentDetails: '' } : undefined,
    dateEmission: iso(dateEmission),
    kind: doc.kind ?? 'devis',
    status: doc.status ?? 'pending',
    signature: signature ? { ...signature, signedAt: iso(signature.signedAt) } : undefined,
    // The delivery token is left out on purpose: lookupQuote() serves a quote
    // by its guessable numero, and the token grants the right to sign the PV.
    delivery: delivery ? { deliveredAt: iso(delivery.deliveredAt), note: delivery.note, liveUrl: delivery.liveUrl } : undefined,
    acceptance: acceptance ? { ...acceptance, signedAt: iso(acceptance.signedAt) } : undefined,
    events: (events ?? []).map((e) => ({ ...e, at: iso(e.at) })),
  }
}

// Quotes created before the electronic-signature feature shipped have no
// signToken in MongoDB — backfill one lazily on first read rather than
// requiring a migration script, so every existing quote gets a working
// signing link the moment it's next looked at.
export async function withSignToken(col: Awaited<ReturnType<typeof quotesCol>>, doc: WithId<QuoteRecord>): Promise<WithId<QuoteRecord>> {
  if (doc.signToken) return doc
  const signToken = generateSignToken()
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

export async function checkRateLimit(scope: string, maxPerHour: number): Promise<boolean> {
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

export { computeDocumentHash, computeAcceptanceHash, isExpired } from '@/lib/quote-hash'

export type QuoteDocumentVariant = 'devis' | 'contrat' | 'pv'

const DOCUMENT_LABEL: Record<string, string> = { devis: 'Devis', contrat: 'Contrat', avenant: 'Avenant', pv: 'PV-recette' }

// A visitor who clicked a broken/stale link had to see the document — this
// builds it as a real file attached to the email instead, so opening it
// never depends on a web page rendering correctly. Never throws: a PDF
// generation hiccup must not stop the underlying email from sending.
export async function buildQuoteAttachment(quote: Quote, variant: QuoteDocumentVariant) {
  try {
    const portfolio = await fetchPortfolioSafe('quote-pdf-attachment')
    const personal = portfolio?.personal ?? defaultPersonalInfo
    const content = await generateQuotePdf({ quote, personal, variant, siteUrl: SITE_URL })
    const label = variant === 'devis' || variant === 'contrat'
      ? DOCUMENT_LABEL[quote.kind === 'avenant' ? 'avenant' : variant]
      : DOCUMENT_LABEL[variant]
    return [{ filename: `${label}-${quote.numero}.pdf`, content, contentType: 'application/pdf' }]
  } catch (e) {
    console.error('[buildQuoteAttachment] PDF generation failed:', e)
    return []
  }
}
