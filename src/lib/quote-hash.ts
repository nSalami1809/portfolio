// Pure hashing / expiry helpers for quotes — no database, no Next: importable
// from tests. The hash of a signed quote is evidence, so what goes into it is
// pinned by tests/quote-hash.test.ts.
import { createHash } from 'crypto'
import type { QuoteRecord } from '@/lib/quotes-core'

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d)

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
    ...(doc.docVersion ? { docVersion: doc.docVersion } : {}),
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

