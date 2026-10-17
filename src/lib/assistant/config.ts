// Settings of the admin assistant. Everything that touches the free Gemini tier
// is decided here, in one place, and every number is a *cautious default of our
// own* — NOT an official Google quota. Google publishes the real per-model
// limits only inside AI Studio; adjust the ASSISTANT_* variables to match them.

// Models Google lists as "Free of charge" on the Gemini API pricing page
// (checked 2026-10-17: https://ai.google.dev/gemini-api/docs/pricing). Google can
// change this list: this is the ONLY place to update it. Anything outside it is
// refused, so a typo or a copy-pasted paid model id can never be called.
// Deliberately excluded even though some are free: the Pro models (heavy on the
// quota) — and every model that is not free (e.g. gemini-3.1-pro-preview).
export const FREE_TIER_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const

export const DEFAULT_ASSISTANT_MODEL = 'gemini-3.6-flash'

export class ModelNotAllowedError extends Error {
  constructor(public readonly modelId: string) {
    super(`Modèle « ${modelId} » refusé : il n'est pas dans la liste des modèles du palier gratuit.`)
    this.name = 'ModelNotAllowedError'
  }
}

export function resolveAssistantModelId(requested: string | undefined = process.env.ASSISTANT_MODEL): string {
  const id = requested?.trim() || DEFAULT_ASSISTANT_MODEL
  if (!(FREE_TIER_MODELS as readonly string[]).includes(id)) throw new ModelNotAllowedError(id)
  return id
}

export interface AssistantLimits {
  /** Model requests per Pacific-time day (Google's daily quota resets at midnight Pacific). */
  dailyRequests: number
  /** Model requests per minute. */
  perMinute: number
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
  dailyRequests: 50,
  perMinute: 4,
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
    dailyRequests: intFrom(env.ASSISTANT_DAILY_REQUESTS, DEFAULT_LIMITS.dailyRequests, 1, 10_000),
    perMinute: intFrom(env.ASSISTANT_PER_MINUTE, DEFAULT_LIMITS.perMinute, 1, 600),
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
