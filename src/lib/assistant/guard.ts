// What must hold before a conversation starts, the pause ordered by Google's own
// "stop" answers, the one-generation-at-a-time lock and the status shown in the
// admin. The per-request counting itself is in limiter.ts (every call to a model
// is counted there, per model); this file only reads those counters.
// Everything is stored in assistant_* collections; none of it can reach site data.
import {
  MODEL_FREE_LIMITS, effectiveCaps, isAssistantEnabled, readLimits, resolveAssistantModelId, resolveWriterModelId,
  ModelNotAllowedError, type AssistantLimits, type FreeLimits,
} from '@/lib/assistant/config'
import { assistantCollections, blockDocId, readDayUsage } from '@/lib/assistant/limiter'
import { BLOCKING_KINDS, classifyModelError, nextPacificMidnight, pacificDayKey, type ClassifiedError } from '@/lib/assistant/quota'

const DAY_MS = 86_400_000

export type PreflightFailure = {
  ok: false
  status: number
  code: 'disabled' | 'model' | 'blocked' | 'daily_cap' | 'busy'
  message: string
  retryAt?: Date
}
export type Preflight = { ok: true; limits: AssistantLimits } | PreflightFailure

export interface ModelStatus {
  role: 'chat' | 'writer'
  id: string
  usedToday: number
  /** What the app allows itself today (Google's daily limit minus the safety margin). */
  dailyCap: number
  perMinuteCap: number
  /** Google's own free-tier limits for this model. */
  official: FreeLimits
  blockedUntil: string | null
  blockMessage: string | null
}

export interface AssistantStatus {
  enabled: boolean
  modelError: string | null
  models: ModelStatus[]
  tokensToday: { input: number; output: number }
  /** The chat model cannot take a request right now (Google asked us to pause, or today's quota is used up). */
  paused: boolean
  pausedUntil: string | null
  pauseMessage: string | null
  nextReset: string
}

async function modelStatus(role: 'chat' | 'writer', id: string, now: Date): Promise<ModelStatus> {
  const caps = effectiveCaps(id)
  const { state } = await assistantCollections()
  const [usedToday, block] = await Promise.all([readDayUsage(id, now), state.findOne({ _id: blockDocId(id) })])
  const blocked = block?.blockedUntil && block.blockedUntil.getTime() > now.getTime() ? block : null
  return {
    role, id, usedToday,
    dailyCap: caps.rpd,
    perMinuteCap: caps.rpm,
    official: (MODEL_FREE_LIMITS as Record<string, FreeLimits>)[id] ?? { rpm: 0, rpd: 0 },
    blockedUntil: blocked?.blockedUntil?.toISOString() ?? null,
    blockMessage: blocked?.message ?? null,
  }
}

/**
 * Everything that must hold BEFORE any request is sent to Google: the assistant is
 * on, both models are free ones, the chat model has not been paused by Google and
 * still has room today, and no other generation is running.
 */
export async function preflight(now: Date = new Date()): Promise<Preflight> {
  if (!isAssistantEnabled()) return { ok: false, status: 503, code: 'disabled', message: "NemCopilotIA est désactivé (ASSISTANT_ENABLED=0)." }
  let chatId: string
  try {
    chatId = resolveAssistantModelId()
    resolveWriterModelId()
  } catch (e) {
    const message = e instanceof ModelNotAllowedError ? e.message : 'Modèle de NemCopilotIA invalide.'
    return { ok: false, status: 503, code: 'model', message }
  }

  const chat = await modelStatus('chat', chatId, now)
  if (chat.blockedUntil) {
    return { ok: false, status: 429, code: 'blocked', message: chat.blockMessage ?? "NemCopilotIA est en pause : quota gratuit atteint.", retryAt: new Date(chat.blockedUntil) }
  }
  if (chat.usedToday >= chat.dailyCap) {
    const retryAt = nextPacificMidnight(now)
    return {
      ok: false, status: 429, code: 'daily_cap', retryAt,
      message: `Quota gratuit du jour atteint pour ${chat.id} (${chat.dailyCap} requêtes, marge de sécurité incluse). Il se renouvelle à minuit, heure du Pacifique. Aucune facturation n'est activée.`,
    }
  }

  if (!(await acquireLock(now))) {
    return { ok: false, status: 409, code: 'busy', message: 'Une réponse est déjà en cours de génération. Attendez sa fin ou arrêtez-la.' }
  }
  return { ok: true, limits: readLimits() }
}

const LOCK_TTL_MS = 150_000

// One generation at a time. The lock expires by itself, so a crashed request can
// never leave the assistant stuck. Upsert trick: the filter only matches an
// expired lock, so a live lock makes the upsert collide on _id (duplicate key).
async function acquireLock(now: Date): Promise<boolean> {
  const { state } = await assistantCollections()
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
    const { state } = await assistantCollections()
    await state.updateOne({ _id: 'lock' }, { $set: { expiresAt: new Date(0) } })
  } catch (e) {
    console.error('[assistant] lock release failed:', e)
  }
}

/** Tokens are informational (the free quotas are counted in requests). */
export async function recordTokens(u: { inputTokens: number; outputTokens: number }, now: Date = new Date()): Promise<void> {
  try {
    const { usage } = await assistantCollections()
    await usage.updateOne(
      { _id: `t:${pacificDayKey(now)}` },
      { $inc: { inputTokens: u.inputTokens, outputTokens: u.outputTokens }, $setOnInsert: { requests: 0, expiresAt: new Date(now.getTime() + 90 * DAY_MS) } },
      { upsert: true },
    )
  } catch (e) {
    console.error('[assistant] token recording failed:', e)
  }
}

/** Google said stop to this model: pause it until `until`, without calling Google again meanwhile. */
export async function blockModelUntil(modelId: string, kind: string, until: Date, message: string, now: Date = new Date()): Promise<void> {
  try {
    const { state } = await assistantCollections()
    await state.updateOne({ _id: blockDocId(modelId) }, { $set: { blockedUntil: until, kind, message, at: now } }, { upsert: true })
  } catch (e) {
    console.error('[assistant] block recording failed:', e)
  }
}

export async function getStatus(now: Date = new Date()): Promise<AssistantStatus> {
  let modelError: string | null = null
  let chatId: string | null = null
  let writerId: string | null = null
  try { chatId = resolveAssistantModelId() } catch (e) { modelError = e instanceof Error ? e.message : 'Modèle invalide.' }
  try { writerId = resolveWriterModelId() } catch (e) { modelError = modelError ?? (e instanceof Error ? e.message : 'Modèle invalide.') }

  const [chat, writer, tokens] = await Promise.all([
    chatId ? modelStatus('chat', chatId, now) : null,
    writerId && writerId !== chatId ? modelStatus('writer', writerId, now) : null,
    assistantCollections().then(({ usage }) => usage.findOne({ _id: `t:${pacificDayKey(now)}` })),
  ])
  // Same model for both roles: one bucket, shown once.
  const models = [chat, writer].filter((m): m is ModelStatus => m !== null)
  const full = chat ? chat.usedToday >= chat.dailyCap : false
  const paused = Boolean(chat && (chat.blockedUntil || full))
  return {
    enabled: isAssistantEnabled(),
    modelError,
    models,
    tokensToday: { input: tokens?.inputTokens ?? 0, output: tokens?.outputTokens ?? 0 },
    paused,
    pausedUntil: chat?.blockedUntil ?? (full ? nextPacificMidnight(now).toISOString() : null),
    pauseMessage: chat?.blockMessage ?? (full && chat ? `Quota gratuit du jour atteint pour ${chat.id} : il se renouvelle à minuit, heure du Pacifique.` : null),
    nextReset: nextPacificMidnight(now).toISOString(),
  }
}

/**
 * Classifies a provider error and, when Google asked us to stop (quota or rate
 * limit), pauses THAT model so the next requests are refused locally instead of
 * being sent to Google again. Our own limiter's refusals are not Google's answers:
 * they never create a pause, the counters already say it.
 */
export async function handleProviderError(err: unknown, now: Date = new Date()): Promise<ClassifiedError> {
  const classified = classifyModelError(err, now)
  if (!classified.local && BLOCKING_KINDS.includes(classified.kind) && classified.retryAt) {
    let modelId = classified.modelId
    if (!modelId) { try { modelId = resolveAssistantModelId() } catch { modelId = undefined } }
    if (modelId) await blockModelUntil(modelId, classified.kind, classified.retryAt, classified.message, now)
  }
  if (classified.kind === 'other') console.error('[assistant] unexpected provider error:', err)
  return classified
}
