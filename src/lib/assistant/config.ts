// Settings of the admin assistant. Everything that touches the free Gemini tier
// is decided here, in one place.

// Models Google lists as "Free of charge" on the Gemini API pricing page
// (checked 2026-10-17: https://ai.google.dev/gemini-api/docs/pricing). Google can
// change this list: this is the ONLY place to update it. Anything outside it is
// refused, so a typo or a copy-pasted paid model id can never be called.
// Deliberately excluded even though some are free: the Pro models (no quota left
// on this project) — and every model that is not free (e.g. gemini-3.1-pro-preview).
export const FREE_TIER_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const

export type FreeTierModel = (typeof FREE_TIER_MODELS)[number]

// The assistant uses two models, each in its own quota bucket:
//  - the "chat" model answers, calls the tools, reads documents and conversations
//    and translates: many small requests, so a model with a generous daily quota;
//  - the "writer" model only writes and revises articles: few requests, better prose.
// There is no automatic fallback from one to the other, nor to any other model:
// when a quota is used up the assistant says so and waits.
export const DEFAULT_ASSISTANT_MODEL: FreeTierModel = 'gemini-3.1-flash-lite'
export const DEFAULT_WRITER_MODEL: FreeTierModel = 'gemini-3.6-flash'

export class ModelNotAllowedError extends Error {
  constructor(public readonly modelId: string) {
    super(`Modèle « ${modelId} » refusé : il n'est pas dans la liste des modèles du palier gratuit.`)
    this.name = 'ModelNotAllowedError'
  }
}

function resolveModelId(requested: string | undefined, fallback: FreeTierModel): FreeTierModel {
  const id = requested?.trim() || fallback
  if (!(FREE_TIER_MODELS as readonly string[]).includes(id)) throw new ModelNotAllowedError(id)
  return id as FreeTierModel
}

export function resolveAssistantModelId(requested: string | undefined = process.env.ASSISTANT_MODEL): FreeTierModel {
  return resolveModelId(requested, DEFAULT_ASSISTANT_MODEL)
}

export function resolveWriterModelId(requested: string | undefined = process.env.ASSISTANT_WRITER_MODEL): FreeTierModel {
  return resolveModelId(requested, DEFAULT_WRITER_MODEL)
}

export interface FreeLimits {
  /** Requests per minute. */
  rpm: number
  /** Requests per day (Pacific-time day: the quota renews at midnight Pacific). */
  rpd: number
}

// The free-tier limits of this project's key, as shown by Google AI Studio →
// "Limites de débit" (read 2026-10-17, project « Default Gemini Project »). These
// are Google's numbers, per model; the app stays below them by QUOTA_MARGIN.
// Update them if AI Studio shows different ones.
export const MODEL_FREE_LIMITS: Record<FreeTierModel, FreeLimits> = {
  'gemini-3.8-flash': { rpm: 5, rpd: 20 },
  'gemini-3.6-flash': { rpm: 5, rpd: 20 },
  'gemini-3.5-flash-lite': { rpm: 15, rpd: 500 },
  'gemini-3.1-flash-lite': { rpm: 15, rpd: 500 },
  'gemini-3-flash-preview': { rpm: 5, rpd: 20 },
  'gemini-2.5-flash': { rpm: 5, rpd: 20 },
  'gemini-2.5-flash-lite': { rpm: 10, rpd: 20 },
}

export const DEFAULT_QUOTA_MARGIN = 0.8

/** Share of Google's limit the app allows itself (ASSISTANT_QUOTA_MARGIN, between 0.1 and 1). */
export function quotaMargin(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseFloat(env.ASSISTANT_QUOTA_MARGIN ?? '')
  return Number.isFinite(n) ? Math.min(1, Math.max(0.1, n)) : DEFAULT_QUOTA_MARGIN
}

/** What the app lets itself send to one model: Google's limit minus the safety margin (at least 1). */
export function effectiveCaps(modelId: string, margin: number = quotaMargin()): FreeLimits {
  const official = (MODEL_FREE_LIMITS as Record<string, FreeLimits | undefined>)[modelId]
  if (!official) return { rpm: 1, rpd: 1 } // unknown model: as careful as possible
  return { rpm: Math.max(1, Math.floor(official.rpm * margin)), rpd: Math.max(1, Math.floor(official.rpd * margin)) }
}

export interface AssistantLimits {
  /** Model steps (calls) in one chat turn. */
  maxSteps: number
  maxOutputTokens: number
  /** Output cap of one drafted article (a French article + metadata). */
  maxDraftTokens: number
  /** Messages of history sent back to the model. */
  maxHistoryMessages: number
  /** Size cap of one request body, in characters. */
  maxBodyChars: number
  /** Size cap of one tool result sent to the model, in characters. */
  maxToolChars: number
}

export const DEFAULT_LIMITS: AssistantLimits = {
  maxSteps: 5,
  maxOutputTokens: 2500,
  maxDraftTokens: 8000,
  maxHistoryMessages: 16,
  maxBodyChars: 150_000,
  maxToolChars: 6000,
}

function intFrom(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function readLimits(env: Record<string, string | undefined> = process.env): AssistantLimits {
  return {
    maxSteps: intFrom(env.ASSISTANT_MAX_STEPS, DEFAULT_LIMITS.maxSteps, 1, 12),
    maxOutputTokens: intFrom(env.ASSISTANT_MAX_OUTPUT_TOKENS, DEFAULT_LIMITS.maxOutputTokens, 256, 16_000),
    maxDraftTokens: intFrom(env.ASSISTANT_MAX_DRAFT_TOKENS, DEFAULT_LIMITS.maxDraftTokens, 1000, 32_000),
    maxHistoryMessages: intFrom(env.ASSISTANT_MAX_HISTORY, DEFAULT_LIMITS.maxHistoryMessages, 2, 60),
    maxBodyChars: DEFAULT_LIMITS.maxBodyChars,
    maxToolChars: DEFAULT_LIMITS.maxToolChars,
  }
}

/** Kill switch: ASSISTANT_ENABLED=0 turns the whole assistant off. */
export function isAssistantEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ASSISTANT_ENABLED !== '0'
}
