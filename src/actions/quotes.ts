'use server'

import { randomBytes } from 'crypto'
import { ObjectId, type WithId } from 'mongodb'
import { after } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { quoteNotificationEmail, quoteClientCopyEmail } from '@/lib/email-templates'

const TVA_RATE = 0.18
const VALIDITE_JOURS = 30
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — avoids visual ambiguity when read aloud

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

export interface Quote extends QuotePayload {
  numero: string
  accessCode: string
  dateEmission: string
  validiteJours: number
  totalHT: number
  tva: number
  totalTTC: number
}

export interface AdminQuote extends Quote {
  id: string
  read: boolean
  createdAt: string
}

interface QuoteRecord extends QuotePayload {
  numero: string
  accessCode: string
  dateEmission: Date
  validiteJours: number
  totalHT: number
  tva: number
  totalTTC: number
  read: boolean
  createdAt: Date
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
    numero, accessCode, dateEmission, validiteJours, totalHT, tva, totalTTC } = doc
  return {
    clientNom, clientSociete, clientAdresse, clientEmail, clientTelephone, descriptionProjet, items,
    numero, accessCode, validiteJours, totalHT, tva, totalTTC,
    dateEmission: dateEmission instanceof Date ? dateEmission.toISOString() : dateEmission,
  }
}

export async function submitQuote(payload: QuotePayload): Promise<Quote> {
  if (!payload.clientNom?.trim()) throw new Error('Nom du client requis.')
  if (!payload.items?.length) throw new Error('Au moins une prestation est requise.')

  const col = await quotes()
  const numero = await nextQuoteNumber()
  const accessCode = generateAccessCode()
  const totalHT = payload.items.reduce((sum, it) => sum + it.quantite * it.prixUnitaireHT, 0)
  const tva = Math.round(totalHT * TVA_RATE)
  const totalTTC = totalHT + tva
  const dateEmission = new Date()

  const quote: Quote = {
    ...payload,
    numero,
    accessCode,
    dateEmission: dateEmission.toISOString(),
    validiteJours: VALIDITE_JOURS,
    totalHT,
    tva,
    totalTTC,
  }

  await col.insertOne({ ...payload, numero, accessCode, dateEmission, validiteJours: VALIDITE_JOURS, totalHT, tva, totalTTC, read: false, createdAt: new Date() })

  // Notify the admin (+ send the client their own copy if we already have an
  // email) in the background — a slow/unreachable SMTP server must never
  // delay the devis appearing in the chat.
  after(async () => {
    try {
      const transporter = getTransporter()
      const notification = quoteNotificationEmail(quote)
      await transporter.sendMail({
        from: `"Portfolio NS · Devis" <${process.env.GMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: notification.subject,
        html: notification.html,
      })

      if (payload.clientEmail) {
        const clientCopy = quoteClientCopyEmail(quote)
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
  return doc ? toQuote(doc) : null
}

// Called when a visitor supplies their email *after* the quote was already
// generated without one — records the email and sends them their copy.
export async function sendQuoteEmail(reference: string, email: string): Promise<{ ok: boolean; message: string }> {
  const ref = reference.trim().toUpperCase()
  const col = await quotes()
  const doc = await col.findOne({ $or: [{ numero: ref }, { accessCode: ref }] })
  if (!doc) return { ok: false, message: 'Devis introuvable pour cette référence.' }

  await col.updateOne({ _id: doc._id }, { $set: { clientEmail: email } })
  const quote = toQuote({ ...doc, clientEmail: email })

  after(async () => {
    try {
      const transporter = getTransporter()
      const clientCopy = quoteClientCopyEmail(quote)
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

// ── Admin actions ────────────────────────────────────────────────────────────

export async function listQuotes(): Promise<AdminQuote[]> {
  const col = await quotes()
  const docs = await col.find({}).sort({ createdAt: -1 }).limit(200).toArray()
  return docs.map((doc) => ({
    ...toQuote(doc),
    id: doc._id.toString(),
    read: doc.read ?? false,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
  }))
}

export async function markQuoteRead(id: string): Promise<void> {
  const col = await quotes()
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { read: true } })
}

export async function deleteQuote(id: string): Promise<void> {
  const col = await quotes()
  await col.deleteOne({ _id: new ObjectId(id) })
}
