import 'server-only'

import { requireAdmin } from '@/lib/require-admin'
import { quotesCol, SITE_URL } from '@/lib/quotes-core'
import type { PendingQuote } from '@/lib/assistant/reminders'

/** Public address of the site, used for the signing link in a reminder. */
export const QUOTE_SITE_URL = SITE_URL

// Quotes still waiting for the client's answer, for the assistant's reminder drafts.
// Read-only. Checks the admin session itself (defence in depth: the assistant route
// already did), and never returns signatures, payment details or access codes.
export async function loadQuotesForReminders(limit = 30): Promise<PendingQuote[]> {
  await requireAdmin()
  const col = await quotesCol()
  const docs = await col
    .find({
      // `status` is absent on the oldest records, which are pending by definition.
      $and: [
        { $or: [{ status: 'pending' }, { status: { $exists: false } }] },
        { signature: { $exists: false } },
        { $or: [{ kind: 'devis' }, { kind: { $exists: false } }] },
      ],
    })
    .sort({ dateEmission: 1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .toArray()
  return docs.map((d) => ({
    numero: d.numero,
    clientNom: d.clientNom,
    clientSociete: d.clientSociete,
    clientEmail: d.clientEmail,
    locale: d.locale === 'en' ? 'en' : 'fr',
    dateEmission: new Date(d.dateEmission).toISOString(),
    validiteJours: d.validiteJours,
    totalTTC: d.totalTTC,
    signToken: d.signToken,
  }))
}
