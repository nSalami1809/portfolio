'use server'

import { ObjectId } from 'mongodb'
import { after } from 'next/server'
import { headers } from 'next/headers'
import { put } from '@vercel/blob'
import { getTransporter } from '@/lib/mailer'
import { getAdminEmail } from '@/lib/admin-config'
import { requireAdmin } from '@/lib/require-admin'
import {
  deliveryEmail, acceptanceSignedClientEmail, acceptanceSignedAdminEmail, quoteClientCopyEmail,
} from '@/lib/email-templates'
import { computeTotals, resolveTerms, snapshotTerms } from '@/lib/business'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { getClientIp } from '@/lib/client-ip'
import {
  quotesCol, toQuote, generateAccessCode, generateSignToken, nextQuoteNumber, checkRateLimit, buildQuoteAttachment,
  computeAcceptanceHash, cleanItems, EMAIL_RE, MAX_SIGNATURE_DECODED_BYTES, SIGNATURE_DATA_URL_PREFIX,
  type QuoteRecord, type QuoteRecordEvent, type QuoteRecordAcceptance,
} from '@/lib/quotes-core'
import type { QuoteItem, SignActionResult } from '@/actions/quotes'

const SIGN_RATE_LIMIT_PER_HOUR = 10
const MAX_NOTE_LENGTH = 1000
const MAX_URL_LENGTH = 300
const MAX_AVENANT_DESCRIPTION = 2000

export type LifecycleResult = { ok: true; message: string } | { ok: false; message: string }

// Only http(s) links may end up printed on a legal document and in an email.
function cleanUrl(raw: string | undefined): string | undefined {
  const v = raw?.trim()
  if (!v) return undefined
  if (v.length > MAX_URL_LENGTH) throw new Error('Adresse trop longue.')
  let parsed: URL
  try { parsed = new URL(v) } catch { throw new Error('Adresse (URL) invalide.') }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Adresse (URL) invalide.')
  return parsed.toString()
}

// The delivery delay depends on the size and constraints of each project, so
// the default from the settings can be adjusted quote by quote — but only while
// the quote is still an offer. Once the client has signed, the delay is part of
// what they agreed to (and of the signed hash): changing it then needs an avenant.
export async function updateQuoteDelay(quoteId: string, deliveryDays: number): Promise<LifecycleResult> {
  await requireAdmin()
  const days = Math.round(Number(deliveryDays))
  if (!Number.isFinite(days) || days < 1 || days > 730) return { ok: false, message: 'Indiquez un délai entre 1 et 730 jours ouvrés.' }

  const col = await quotesCol()
  const doc = await col.findOne({ _id: new ObjectId(quoteId) })
  if (!doc) return { ok: false, message: 'Devis introuvable.' }
  if (doc.signature || (doc.status ?? 'pending') !== 'pending') {
    return { ok: false, message: 'Ce devis est déjà signé, accepté ou refusé : pour modifier le délai, créez un avenant.' }
  }

  const portfolio = await fetchPortfolioSafe('updateQuoteDelay')
  const previous = resolveTerms(doc, portfolio?.personal ?? defaultPersonalInfo)
  if (previous.deliveryDays === days) return { ok: true, message: 'Délai inchangé.' }
  const terms = { ...previous, deliveryDays: days }
  const event: QuoteRecordEvent = { type: 'delay_changed', at: new Date(), meta: { from: String(previous.deliveryDays), to: String(days) } }
  const result = await col.updateOne(
    { _id: doc._id, signature: { $exists: false }, status: 'pending' },
    { $set: { terms }, $push: { events: event } },
  )
  if (result.matchedCount === 0) return { ok: false, message: "Ce devis vient d'être signé ou modifié." }
  return { ok: true, message: `Délai fixé à ${days} jours ouvrés. Le lien de signature l'affiche déjà ; un PDF envoyé avant ce changement indique l'ancien délai.` }
}

// ── Livraison → procès-verbal de recette ────────────────────────────────────

// Admin marks the project as delivered: opens the recette period (the client
// gets a procès-verbal to sign) and unlocks the balance invoice.
export async function markDelivered(quoteId: string, input: { note?: string; liveUrl?: string }): Promise<LifecycleResult> {
  await requireAdmin()
  const col = await quotesCol()
  const doc = await col.findOne({ _id: new ObjectId(quoteId) })
  if (!doc) return { ok: false, message: 'Devis introuvable.' }
  if ((doc.status ?? 'pending') !== 'accepted') return { ok: false, message: 'Seul un devis accepté (signé) peut être livré.' }
  if (doc.delivery) return { ok: false, message: 'Ce projet est déjà marqué comme livré.' }

  let liveUrl: string | undefined
  try { liveUrl = cleanUrl(input.liveUrl) } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'URL invalide.' } }
  const note = input.note?.trim().slice(0, MAX_NOTE_LENGTH) || undefined

  const deliveredAt = new Date()
  const delivery = { deliveredAt, ...(note ? { note } : {}), ...(liveUrl ? { liveUrl } : {}) }
  const event: QuoteRecordEvent = { type: 'delivered', at: deliveredAt }
  const result = await col.updateOne(
    { _id: doc._id, delivery: { $exists: false } },
    { $set: { delivery }, $push: { events: event } },
  )
  if (result.matchedCount === 0) return { ok: false, message: 'Ce projet est déjà marqué comme livré.' }

  const quote = toQuote({ ...doc, delivery })
  if (quote.clientEmail && quote.signToken) {
    after(async () => {
      try {
        const transporter = getTransporter()
        const adminEmail = await getAdminEmail()
        const attachments = await buildQuoteAttachment(quote, 'pv')
        const mail = deliveryEmail({ ...quote, signToken: quote.signToken! }, adminEmail)
        await transporter.sendMail({
          from: `"${quote.terms?.provider.name ?? defaultPersonalInfo.name}" <${process.env.GMAIL_USER}>`,
          to: quote.clientEmail,
          subject: mail.subject,
          html: mail.html,
          attachments,
        })
      } catch (e) {
        console.error('[markDelivered] email error:', e)
      }
    })
  }
  return { ok: true, message: quote.clientEmail ? 'Livraison enregistrée — procès-verbal envoyé au client.' : 'Livraison enregistrée (le client n\'a pas d\'email : partagez-lui le lien de signature).' }
}

export interface SignAcceptanceInput {
  clientName: string
  signatureDataUrl: string
  // Free-text reserves. Empty = "recette sans réserve".
  reserves?: string
}

// Public: the client signs the procès-verbal from the same private
// /devis/signature/[token] link they signed the devis with. Once written the
// acceptance is immutable (compare-and-set below, never cleared anywhere).
export async function signAcceptance(token: string, input: SignAcceptanceInput): Promise<SignActionResult> {
  if (typeof token !== 'string' || token.length < 20) return { ok: false, error: 'Lien invalide.' }
  const clientName = input.clientName?.trim()
  if (!clientName || clientName.length < 2 || clientName.length > 100) return { ok: false, error: 'Nom complet requis.' }
  const reserves = input.reserves?.trim().slice(0, MAX_NOTE_LENGTH) || ''
  if (typeof input.signatureDataUrl !== 'string' || !input.signatureDataUrl.startsWith(SIGNATURE_DATA_URL_PREFIX)) {
    return { ok: false, error: 'Signature invalide.' }
  }
  const base64 = input.signatureDataUrl.slice(SIGNATURE_DATA_URL_PREFIX.length)
  if (base64.length * 0.75 > MAX_SIGNATURE_DECODED_BYTES) return { ok: false, error: 'Signature trop volumineuse.' }
  if (!(await checkRateLimit('sign-quote', SIGN_RATE_LIMIT_PER_HOUR))) return { ok: false, error: 'Trop de tentatives. Réessayez plus tard.' }

  const col = await quotesCol()
  const doc = await col.findOne({ signToken: token })
  if (!doc) return { ok: false, error: 'Devis introuvable.' }
  if ((doc.status ?? 'pending') !== 'accepted') return { ok: false, error: "Ce devis n'a pas été accepté." }
  if (!doc.delivery) return { ok: false, error: "Ce projet n'a pas encore été livré." }
  if (doc.acceptance) return { ok: false, error: 'Ce procès-verbal a déjà été signé.' }

  const email = doc.signature?.email || doc.clientEmail
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: 'Adresse email du client manquante.' }

  let imageUrl: string
  try {
    const blob = await put(`signatures/pv-${doc._id.toString()}-${Date.now()}.png`, Buffer.from(base64, 'base64'), {
      access: 'public', contentType: 'image/png', addRandomSuffix: true,
    })
    imageUrl = blob.url
  } catch (e) {
    console.error('[signAcceptance] blob upload error:', e)
    return { ok: false, error: "Erreur lors de l'enregistrement de la signature." }
  }

  const signedAt = new Date()
  const ip = await getClientIp()
  const userAgent = (await headers()).get('user-agent') ?? undefined
  const acceptance: QuoteRecordAcceptance = {
    name: clientName, email, imageUrl, signedAt,
    documentHash: computeAcceptanceHash(doc, reserves, signedAt),
    ...(reserves ? { reserves } : {}),
  }
  const event: QuoteRecordEvent = {
    type: 'delivery_accepted', at: signedAt,
    meta: { ip, reserves: reserves ? 'yes' : 'no', ...(userAgent ? { userAgent } : {}) },
  }
  const result = await col.updateOne(
    { _id: doc._id, acceptance: { $exists: false }, delivery: { $exists: true } },
    { $set: { acceptance }, $push: { events: event } },
  )
  if (result.matchedCount === 0) return { ok: false, error: 'Ce procès-verbal a déjà été signé.' }

  const quote = toQuote((await col.findOne({ _id: doc._id }))!)
  after(async () => {
    try {
      const transporter = getTransporter()
      const adminEmail = await getAdminEmail()
      const attachments = await buildQuoteAttachment(quote, 'pv')
      const clientMail = acceptanceSignedClientEmail(quote, adminEmail)
      const adminMail = acceptanceSignedAdminEmail(quote)
      await Promise.all([
        transporter.sendMail({ from: `"${quote.terms?.provider.name ?? defaultPersonalInfo.name}" <${process.env.GMAIL_USER}>`, to: email, subject: clientMail.subject, html: clientMail.html, attachments }),
        transporter.sendMail({ from: `"Portfolio NS · Devis" <${process.env.GMAIL_USER}>`, to: adminEmail, subject: adminMail.subject, html: adminMail.html, attachments }),
      ])
    } catch (e) {
      console.error('[signAcceptance] email error:', e)
    }
  })
  return { ok: true, quote }
}

// ── Avenant ──────────────────────────────────────────────────────────────────

export interface AvenantInput {
  description: string
  items: QuoteItem[]
  extraDelayDays?: number
}

// Admin creates a complementary quote amending a signed contract — the
// "devis complémentaire" the contract promises for any out-of-scope request.
// It follows the exact same sign-by-link lifecycle as a devis, and is invoiced
// on its own (its own deposit and balance).
export async function createAvenant(parentId: string, input: AvenantInput): Promise<LifecycleResult> {
  await requireAdmin()
  const description = input.description?.trim()
  if (!description) return { ok: false, message: "Décrivez l'objet de l'avenant." }
  if (description.length > MAX_AVENANT_DESCRIPTION) return { ok: false, message: 'Description trop longue.' }
  if (!input.items?.length || input.items.length > 30) return { ok: false, message: 'Ajoutez entre 1 et 30 prestations.' }
  let items: QuoteItem[]
  try { items = cleanItems(input.items) } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Prestations invalides.' } }
  const extraDelayDays = Math.max(0, Math.min(365, Math.round(Number(input.extraDelayDays) || 0)))

  const col = await quotesCol()
  const parent = await col.findOne({ _id: new ObjectId(parentId) })
  if (!parent) return { ok: false, message: 'Devis introuvable.' }
  if ((parent.status ?? 'pending') !== 'accepted') return { ok: false, message: 'Un avenant ne peut être émis que sur un contrat accepté (signé).' }
  if ((parent.kind ?? 'devis') === 'avenant') return { ok: false, message: "Un avenant s'attache au contrat initial, pas à un autre avenant." }

  const portfolio = await fetchPortfolioSafe('createAvenant')
  const terms = parent.terms ?? snapshotTerms(portfolio?.personal ?? defaultPersonalInfo)
  const { totalHT, tva, totalTTC } = computeTotals(items, terms)
  const dateEmission = new Date()
  const numero = await nextQuoteNumber('avenant')
  const createdEvent: QuoteRecordEvent = { type: 'created', at: dateEmission, meta: { parent: parent.numero } }

  const record: QuoteRecord = {
    clientNom: parent.clientNom, clientSociete: parent.clientSociete, clientAdresse: parent.clientAdresse,
    clientEmail: parent.clientEmail, clientTelephone: parent.clientTelephone,
    descriptionProjet: description, items,
    numero, accessCode: generateAccessCode(), signToken: generateSignToken(),
    dateEmission, validiteJours: 30, totalHT, tva, totalTTC,
    read: true, createdAt: dateEmission, status: 'pending', kind: 'avenant', parentNumero: parent.numero,
    ...(extraDelayDays ? { extraDelayDays } : {}),
    terms, events: [createdEvent],
  }
  const { insertedId } = await col.insertOne(record)
  await col.updateOne({ _id: parent._id }, { $push: { events: { type: 'avenant_created', at: dateEmission, meta: { numero } } } })

  const quote = toQuote({ ...record, _id: insertedId })
  if (quote.clientEmail) {
    after(async () => {
      try {
        const transporter = getTransporter()
        const adminEmail = await getAdminEmail()
        const attachments = await buildQuoteAttachment(quote, 'devis')
        const mail = quoteClientCopyEmail({ ...quote, signToken: quote.signToken! }, adminEmail)
        await transporter.sendMail({
          from: `"${terms.provider.name}" <${process.env.GMAIL_USER}>`,
          to: quote.clientEmail,
          subject: mail.subject,
          html: mail.html,
          attachments,
        })
      } catch (e) {
        console.error('[createAvenant] email error:', e)
      }
    })
  }
  return { ok: true, message: `Avenant ${numero} créé${quote.clientEmail ? ' et envoyé au client pour signature' : " (le client n'a pas d'email : copiez le lien de signature)"}.` }
}
