'use server'

import { after } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getTransporter } from '@/lib/mailer'
import { quoteNotificationEmail } from '@/lib/email-templates'

const TVA_RATE = 0.18
const VALIDITE_JOURS = 30

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
  dateEmission: string
  validiteJours: number
  totalHT: number
  tva: number
  totalTTC: number
}

async function nextQuoteNumber(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.collection('quotes').countDocuments({ numero: { $regex: `^DEV-${year}-` } })
  return `DEV-${year}-${String(count + 1).padStart(3, '0')}`
}

export async function submitQuote(payload: QuotePayload): Promise<Quote> {
  if (!payload.clientNom?.trim()) throw new Error('Nom du client requis.')
  if (!payload.items?.length) throw new Error('Au moins une prestation est requise.')

  const db = await getDb()
  const numero = await nextQuoteNumber(db)
  const totalHT = payload.items.reduce((sum, it) => sum + it.quantite * it.prixUnitaireHT, 0)
  const tva = Math.round(totalHT * TVA_RATE)
  const totalTTC = totalHT + tva
  const dateEmission = new Date()

  const quote: Quote = {
    ...payload,
    numero,
    dateEmission: dateEmission.toISOString(),
    validiteJours: VALIDITE_JOURS,
    totalHT,
    tva,
    totalTTC,
  }

  await db.collection('quotes').insertOne({ ...quote, dateEmission, createdAt: new Date() })

  // Notify the admin in the background — a slow/unreachable SMTP server must
  // never delay the devis appearing in the chat. after() keeps this running
  // past the point the response is already sent, instead of blocking on it.
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
    } catch (e) {
      console.error('[submitQuote] email error:', e)
    }
  })

  return quote
}
