// Usage limits, the "quota reached" pause and the one-generation-at-a-time lock.
// Everything is stored in assistant_* collections; none of it can reach site data.
import { getDb } from '@/lib/mongodb'
import { isAssistantEnabled, readLimits, resolveAssistantModelId, ModelNotAllowedError, type AssistantLimits } from '@/lib/assistant/config'
import { BLOCKING_KINDS, classifyModelError, formatLibrevilleTime, nextPacificMidnight, pacificDayKey, type ClassifiedError } from '@/lib/assistant/quota'

interface UsageDoc { _id: string; requests: number; inputTokens: number; outputTokens: number; expiresAt: Date }
interface StateDoc { _id: string; blockedUntil?: Date; kind?: string; message?: string; at?: Date; expiresAt?: Date }

const DAY = 86_400_000
let indexes: Promise<unknown> | null = null

async function cols() {
  const db = await getDb()
  const usage = db.collection<UsageDoc>('assistant_usage')
  const state = db.collection<StateDoc>('assistant_state')
  if (!indexes) indexes = usage.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((e) => console.error('[assistant] index creation failed:', e))
  return { usage, state }
}

const dayId = (d: Date) => `day:${pacificDayKey(d)}`
const minuteId = (d: Date) => `min:${Math.floor(d.getTime() / 60_000)}`

export type PreflightFailure = {
  ok: false
  status: number
  code: 'disabled' | 'model' | 'blocked' | 'daily_cap' | 'minute_cap' | 'busy'
  message: string
  retryAt?: Date
}
export type Preflight = { ok: true; usedToday: number; limits: AssistantLimits } | PreflightFailure

/**
 * Everything that must hold BEFORE any request is sent to Google: the assistant is
 * on, the model is a free one, the provider has not told us to pause, today's
 * and this minute's caps have room, and no other generation is running.
 */
export async function preflight(now: Date = new Date()): Promise<Preflight> {
  if (!isAssistantEnabled()) return { ok: false, status: 503, code: 'disabled', message: "L'assistant est désactivé (ASSISTANT_ENABLED=0)." }
  try {
    resolveAssistantModelId()
  } catch (e) {
    const message = e instanceof ModelNotAllowedError ? e.message : 'Modèle de l’assistant invalide.'
    return { ok: false, status: 503, code: 'model', message }
  }

  const limits = readLimits()
  const { usage, state } = await cols()

  const quota = await state.findOne({ _id: 'quota' })
  if (quota?.blockedUntil && quota.blockedUntil.getTime() > now.getTime()) {
    return { ok: false, status: 429, code: 'blocked', message: quota.message ?? "L'assistant est en pause : quota gratuit atteint.", retryAt: quota.blockedUntil }
  }

  const today = await usage.findOne({ _id: dayId(now) })
  const usedToday = today?.requests ?? 0
  if (usedToday >= limits.dailyRequests) {
    const retryAt = nextPacificMidnight(now)
    return {
      ok: false, status: 429, code: 'daily_cap', retryAt,
      message: `Plafond quotidien de l'assistant atteint (${limits.dailyRequests} requêtes, réglage prudent de l'application). Il se renouvelle à minuit, heure du Pacifique, soit vers ${formatLibrevilleTime(retryAt)} à Libreville.`,
    }
  }

  const minute = await usage.findOne({ _id: minuteId(now) })
  if ((minute?.requests ?? 0) >= limits.perMinute) {
    const retryAt = new Date((Math.floor(now.getTime() / 60_000) + 1) * 60_000)
    return { ok: false, status: 429, code: 'minute_cap', retryAt, message: `Trop de requêtes en une minute (maximum ${limits.perMinute}). Réessayez dans quelques secondes.` }
  }

  if (!(await acquireLock(now))) {
    return { ok: false, status: 409, code: 'busy', message: 'Une réponse est déjà en cours de génération. Attendez sa fin ou arrêtez-la.' }
  }
  await usage.updateOne(
    { _id: minuteId(now) },
    { $inc: { requests: 1 }, $setOnInsert: { inputTokens: 0, outputTokens: 0, expiresAt: new Date(now.getTime() + 10 * 60_000) } },
    { upsert: true },
  )
  return { ok: true, usedToday, limits }
}

const LOCK_TTL_MS = 150_000

// One generation at a time. The lock expires by itself, so a crashed request can
// never leave the assistant stuck. Upsert trick: the filter only matches an
// expired lock, so a live lock makes the upsert collide on _id (duplicate key).
async function acquireLock(now: Date): Promise<boolean> {
  const { state } = await cols()
  try {
    await state.updateOne(
      { _id: 'lock', expiresAt: { $lt: now } },
      { $set: { expiresAt: new Date(now.getTime() + LOCK_TTL_MS), at: now } },
      { upsert: true },
    )
    return true
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false
    throw e
  }
}

export async function releaseLock(): Promise<void> {
  try {
    const { state } = await cols()
    await state.updateOne({ _id: 'lock' }, { $set: { expiresAt: new Date(0) } })
  } catch (e) {
    console.error('[assistant] lock release failed:', e)
  }
}

export interface RunUsage { requests: number; inputTokens: number; outputTokens: number }

export async function recordUsage(u: RunUsage, now: Date = new Date()): Promise<void> {
  try {
    const { usage } = await cols()
    await usage.updateOne(
      { _id: dayId(now) },
      { $inc: { requests: u.requests, inputTokens: u.inputTokens, outputTokens: u.outputTokens }, $setOnInsert: { expiresAt: new Date(now.getTime() + 90 * DAY) } },
      { upsert: true },
    )
  } catch (e) {
    console.error('[assistant] usage recording failed:', e)
  }
}

/** The provider said stop: pause the assistant until `until`, without calling Google again meanwhile. */
export async function blockUntil(kind: string, until: Date, message: string, now: Date = new Date()): Promise<void> {
  try {
    const { state } = await cols()
    await state.updateOne({ _id: 'quota' }, { $set: { blockedUntil: until, kind, message, at: now } }, { upsert: true })
  } catch (e) {
    console.error('[assistant] block recording failed:', e)
  }
}

export interface AssistantStatus {
  enabled: boolean
  model: string | null
  modelError: string | null
  limits: { dailyRequests: number; perMinute: number }
  today: { day: string; requests: number; inputTokens: number; outputTokens: number }
  blockedUntil: string | null
  blockMessage: string | null
  nextReset: string
}

export async function getStatus(now: Date = new Date()): Promise<AssistantStatus> {
  const limits = readLimits()
  let model: string | null = null
  let modelError: string | null = null
  try { model = resolveAssistantModelId() } catch (e) { modelError = e instanceof Error ? e.message : 'Modèle invalide.' }

  const { usage, state } = await cols()
  const [today, quota] = await Promise.all([usage.findOne({ _id: dayId(now) }), state.findOne({ _id: 'quota' })])
  const blocked = quota?.blockedUntil && quota.blockedUntil.getTime() > now.getTime() ? quota : null
  return {
    enabled: isAssistantEnabled(),
    model,
    modelError,
    limits: { dailyRequests: limits.dailyRequests, perMinute: limits.perMinute },
    today: { day: pacificDayKey(now), requests: today?.requests ?? 0, inputTokens: today?.inputTokens ?? 0, outputTokens: today?.outputTokens ?? 0 },
    blockedUntil: blocked?.blockedUntil?.toISOString() ?? null,
    blockMessage: blocked?.message ?? null,
    nextReset: nextPacificMidnight(now).toISOString(),
  }
}

/**
 * Classifies a provider error and, when Google asked us to stop (quota or rate
 * limit), records the pause so the next requests are refused locally instead of
 * being sent to Google again.
 */
export async function handleProviderError(err: unknown, now: Date = new Date()): Promise<ClassifiedError> {
  const classified = classifyModelError(err, now)
  if (BLOCKING_KINDS.includes(classified.kind) && classified.retryAt) {
    await blockUntil(classified.kind, classified.retryAt, classified.message, now)
  }
  if (classified.kind === 'other') console.error('[assistant] unexpected provider error:', err)
  return classified
}
