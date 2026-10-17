// The database side of the request limiter, and the model wrapper that applies it.
// Counters live in assistant_usage (one document per model and minute/day, expiring
// by themselves); a pause ordered by Google's own 429 lives in assistant_state.
import { wrapLanguageModel } from 'ai'
import { getDb } from '@/lib/mongodb'
import { effectiveCaps, quotaMargin } from '@/lib/assistant/config'
import { acquireRequest, type LimiterStore } from '@/lib/assistant/limiter-core'
import { pacificDayKey } from '@/lib/assistant/quota'

export interface UsageDoc { _id: string; requests: number; inputTokens?: number; outputTokens?: number; expiresAt: Date }
export interface StateDoc { _id: string; blockedUntil?: Date; kind?: string; message?: string; at?: Date; expiresAt?: Date }

const DAY_MS = 86_400_000
let indexes: Promise<unknown> | null = null

export async function assistantCollections() {
  const db = await getDb()
  const usage = db.collection<UsageDoc>('assistant_usage')
  const state = db.collection<StateDoc>('assistant_state')
  if (!indexes) indexes = usage.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((e) => console.error('[assistant] index creation failed:', e))
  return { usage, state }
}

export const dayDocId = (modelId: string, dayKey: string) => `d:${dayKey}:${modelId}`
export const minuteDocId = (modelId: string, minuteIndex: number) => `m:${minuteIndex}:${modelId}`
export const blockDocId = (modelId: string) => `quota:${modelId}`

// One atomic step: "+1 if still under the cap". The upsert makes the first request of
// a period create the document; when the cap is reached the filter no longer matches,
// the upsert collides on _id, and the duplicate-key error is the answer "full".
async function take(id: string, cap: number, expiresAt: Date): Promise<boolean> {
  const { usage } = await assistantCollections()
  try {
    const r = await usage.findOneAndUpdate(
      { _id: id, requests: { $lt: cap } },
      { $inc: { requests: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: 'after' },
    )
    return r !== null
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false
    throw e
  }
}

export function mongoLimiterStore(): LimiterStore {
  return {
    takeMinute: (modelId, minuteIndex, cap) => take(minuteDocId(modelId, minuteIndex), cap, new Date((minuteIndex + 10) * 60_000)),
    takeDay: (modelId, dayKey, cap) => take(dayDocId(modelId, dayKey), cap, new Date(Date.now() + 3 * DAY_MS)),
    getBlock: async (modelId) => {
      const { state } = await assistantCollections()
      const doc = await state.findOne({ _id: blockDocId(modelId) })
      return doc?.blockedUntil ? { until: doc.blockedUntil, message: doc.message ?? 'Quota gratuit atteint : assistant en pause.' } : null
    },
  }
}

/** Requests sent today (Pacific day) to a model, as the limiter counted them. */
export async function readDayUsage(modelId: string, now: Date = new Date()): Promise<number> {
  const { usage } = await assistantCollections()
  return (await usage.findOne({ _id: dayDocId(modelId, pacificDayKey(now)) }))?.requests ?? 0
}

type WrappableModel = Parameters<typeof wrapLanguageModel>[0]['model']

// Remembers which model an error came from, so a "stop" from Google pauses that
// model only (the other one keeps its own quota).
function tag(error: unknown, modelId: string): unknown {
  if (error && typeof error === 'object') {
    try { Object.defineProperty(error, 'assistantModelId', { value: modelId, configurable: true }) } catch { /* frozen error: no tag */ }
  }
  return error
}

/**
 * Every call the SDK makes to the model — a chat step, a tool's own request, a
 * retry — goes through the limiter first. A refused call never reaches Google.
 */
export function limitModel(model: WrappableModel, modelId: string, margin: number = quotaMargin()) {
  const caps = effectiveCaps(modelId, margin)
  const store = mongoLimiterStore()
  const gate = () => acquireRequest(store, modelId, caps)
  return wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: async ({ doGenerate }) => {
        await gate()
        try { return await doGenerate() } catch (e) { throw tag(e, modelId) }
      },
      wrapStream: async ({ doStream }) => {
        await gate()
        try { return await doStream() } catch (e) { throw tag(e, modelId) }
      },
    },
  })
}
