import 'server-only'

import { getDb } from '@/lib/mongodb'
import type { AppliedRecord } from '@/lib/draft-apply'

// The journal of what "Appliquer" changed: the key as it was before and after,
// enough to undo it in one click as long as nobody touched that part of the site
// since. Kept 180 days.
interface AppliedDoc extends Omit<AppliedRecord, 'at'> { at: Date; undoneAt?: Date; expiresAt: Date }

let indexes: Promise<unknown> | null = null
async function col() {
  const db = await getDb()
  const c = db.collection<AppliedDoc>('assistant_applied')
  if (!indexes) {
    indexes = Promise.all([
      c.createIndex({ draftId: 1 }),
      c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((e) => console.error('[assistant] applied journal indexes failed:', e))
  }
  return c
}

export async function journalApplied(record: AppliedRecord): Promise<void> {
  const c = await col()
  await c.insertOne({ ...record, expiresAt: new Date(record.at.getTime() + 180 * 86_400_000) })
}

export async function getApplied(draftId: string): Promise<(AppliedRecord & { undoneAt?: Date }) | null> {
  const c = await col()
  const doc = await c.find({ draftId }).sort({ at: -1 }).limit(1).next()
  if (!doc) return null
  const { expiresAt: _expiresAt, ...rest } = doc
  void _expiresAt
  return rest as AppliedRecord & { undoneAt?: Date }
}

export async function markUndone(draftId: string): Promise<void> {
  const c = await col()
  await c.updateMany({ draftId, undoneAt: { $exists: false } }, { $set: { undoneAt: new Date() } })
}
