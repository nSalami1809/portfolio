import 'server-only'

import { getDb } from '@/lib/mongodb'
import type { FaqTopic } from '@/lib/instant-answers'

// How many visitor questions were answered by the rules instead of the model: one small
// document per day. It is the measure of the free-tier requests that were NOT spent.
const COLLECTION = 'chat_instant_stats'
const KEEP_DAYS = 120

const dayKey = (d: Date) => `d:${d.toISOString().slice(0, 10)}`

let indexes: Promise<unknown> | null = null
async function col() {
  const c = (await getDb()).collection<{ _id: string; count: number; byTopic: Record<string, number>; expireAt: Date }>(COLLECTION)
  if (!indexes) indexes = c.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch((e) => console.error('[instant] index failed:', e))
  return c
}

/** Best-effort: a failure here never delays or breaks the answer. */
export async function countInstantAnswer(topic: FaqTopic, now: Date = new Date()): Promise<void> {
  if (process.env.E2E_DRY_RUN === '1') return
  try {
    const c = await col()
    await c.updateOne(
      { _id: dayKey(now) },
      { $inc: { count: 1, [`byTopic.${topic}`]: 1 }, $setOnInsert: { expireAt: new Date(now.getTime() + KEEP_DAYS * 86_400_000) } },
      { upsert: true },
    )
  } catch (e) {
    console.error('[instant] count failed:', e)
  }
}

export interface InstantStats { today: number; last7Days: number }

export async function readInstantStats(now: Date = new Date()): Promise<InstantStats> {
  const c = await col()
  const keys = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - i * 86_400_000)))
  const docs = await c.find({ _id: { $in: keys } }).toArray()
  const today = docs.find((d) => d._id === keys[0])?.count ?? 0
  return { today, last7Days: docs.reduce((n, d) => n + d.count, 0) }
}
