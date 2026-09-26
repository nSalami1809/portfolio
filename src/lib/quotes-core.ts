// Shared internals of the quote lifecycle (devis → contrat → livraison →
// factures). Lives outside 'use server' files on purpose: a 'use server'
// module may only export async functions that become public endpoints, and
// none of what is below (collection handles, hashing, rate limiting, PDF
// attachment building) should ever be callable from a browser.
import { randomBytes, createHash } from 'crypto'
import type { WithId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getClientIp } from '@/lib/client-ip'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { generateQuotePdf } from '@/lib/quote-pdf'
import type { QuoteTerms } from '@/lib/business'
import type { Quote, QuotePayload, QuoteStatus, QuoteEventType, QuoteKind, QuoteBrief, QuoteItem } from '@/actions/quotes'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — avoids visual ambiguity when read aloud
export const SIGN_TOKEN_BYTES = 32 // 256 bits — the public /devis/signature/[token] link must be unguessable
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

export function quotesCol() {
  return getDb().then((db) => db.collection<QuoteRecord>('quotes'))
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
// prefix and year.
export async function nextQuoteNumber(kind: QuoteKind = 'devis'): Promise<string> {
  const col = await quotesCol()
  const year = new Date().getFullYear()
  const prefix = kind === 'avenant' ? 'AVN' : 'DEV'
  const count = await col.countDocuments({ numero: { $regex: `^${prefix}-${year}-` } })
  return `${prefix}-${year}-${String(count + 1).padStart(3, '0')}`
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d)

export function toQuote(doc: WithId<QuoteRecord>): Quote {
  const { clientNom, clientSociete, clientAdresse, clientEmail, clientTelephone, descriptionProjet, items, brief,
    numero, accessCode, signToken, dateEmission, validiteJours, totalHT, tva, totalTTC, signature, events,
    parentNumero, extraDelayDays, terms, delivery, acceptance } = doc
  return {
    clientNom, clientSociete, clientAdresse, clientEmail, clientTelephone, descriptionProjet, items, brief,
    numero, accessCode, signToken, validiteJours, totalHT, tva, totalTTC, parentNumero, extraDelayDays, terms,
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

// Canonical snapshot of everything the client actually agreed to — hashed at
// the moment of signing so any later, hypothetical tampering with the stored
// document can be detected. Key order is fixed by construction, so the same
// quote content always produces the same hash. Optional parts (brief, terms,
// avenant parent) are only included when present, which keeps the hash of a
// quote signed before those existed identical to what it was then.
export function computeDocumentHash(doc: QuoteRecord): string {
  const canonical = JSON.stringify({
    numero: doc.numero,
    client: { nom: doc.clientNom, societe: doc.clientSociete ?? '', adresse: doc.clientAdresse ?? '', email: doc.clientEmail ?? '', telephone: doc.clientTelephone ?? '' },
    description: doc.descriptionProjet,
    items: doc.items,
    totalHT: doc.totalHT,
    tva: doc.tva,
    totalTTC: doc.totalTTC,
    dateEmission: iso(doc.dateEmission),
    validiteJours: doc.validiteJours,
    ...(doc.brief ? { brief: doc.brief } : {}),
    ...(doc.terms ? { terms: doc.terms } : {}),
    ...(doc.parentNumero ? { parentNumero: doc.parentNumero } : {}),
    ...(doc.extraDelayDays ? { extraDelayDays: doc.extraDelayDays } : {}),
  })
  return createHash('sha256').update(canonical).digest('hex')
}

// Hash of what the client accepted at the delivery report (PV de recette):
// the contract it belongs to, what was delivered, and the reserves stated.
export function computeAcceptanceHash(doc: QuoteRecord, reserves: string, acceptedAt: Date): string {
  const canonical = JSON.stringify({
    numero: doc.numero,
    contractHash: doc.signature?.documentHash ?? '',
    items: doc.items,
    delivery: doc.delivery ? { deliveredAt: iso(doc.delivery.deliveredAt), note: doc.delivery.note ?? '', liveUrl: doc.delivery.liveUrl ?? '' } : null,
    reserves,
    acceptedAt: acceptedAt.toISOString(),
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export function isExpired(doc: Pick<QuoteRecord, 'dateEmission' | 'validiteJours'>): boolean {
  const expiry = new Date(doc.dateEmission)
  expiry.setDate(expiry.getDate() + doc.validiteJours)
  return Date.now() > expiry.getTime()
}

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
