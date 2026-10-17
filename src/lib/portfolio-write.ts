import 'server-only'

import { getDb } from '@/lib/mongodb'
import { PATCH_FIELDS } from '@/lib/assistant/drafts'

// The narrowest possible write to the portfolio document: ONE top-level key, and
// only if the document is still at the version the caller read. publishPortfolio()
// replaces everything with no such check; this is for changes made from a read the
// administrator spent time reviewing (applying a draft, undoing it), where a
// concurrent edit must win rather than be overwritten.

const DOC_ID = 'main'
const ALLOWED_KEYS = new Set<string>(Object.keys(PATCH_FIELDS))

export async function replacePortfolioKey(key: string, value: unknown, expectedVersion: string): Promise<'ok' | 'conflict'> {
  if (!ALLOWED_KEYS.has(key)) throw new Error(`Clé du portfolio non autorisée : ${key}`)
  const db = await getDb()
  const filter = expectedVersion === 'none'
    ? { _id: DOC_ID as unknown as never, updatedAt: { $exists: false } }
    : { _id: DOC_ID as unknown as never, updatedAt: new Date(expectedVersion) }
  const result = await db.collection('portfolio').updateOne(filter, { $set: { [key]: value, updatedAt: new Date() } })
  return result.matchedCount === 1 ? 'ok' : 'conflict'
}
