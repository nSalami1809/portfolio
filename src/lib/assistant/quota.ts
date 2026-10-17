// Pure helpers for the free Gemini tier: when does the daily quota renew, and
// what does a provider error actually mean. No database, no network.

const PACIFIC = 'America/Los_Angeles'
const LIBREVILLE = 'Africa/Libreville'

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Calendar day in Pacific time (YYYY-MM-DD) — Google's daily quota boundary. */
export function pacificDayKey(d: Date): string {
  return dayFmt.format(d)
}

/** First instant of the next Pacific-time day (handles daylight-saving changes). */
export function nextPacificMidnight(from: Date): Date {
  const key = pacificDayKey(from)
  let lo = from.getTime()
  let hi = lo + 26 * 3_600_000 // a day is never longer than 25 h
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (pacificDayKey(new Date(mid)) === key) lo = mid
    else hi = mid
  }
  return new Date(hi)
}

/** "08:00" in the admin's time zone (Libreville). */
export function formatLibrevilleTime(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: LIBREVILLE, hour: '2-digit', minute: '2-digit' }).format(d)
}

export type AssistantErrorKind = 'quota_daily' | 'rate_limit' | 'auth' | 'model' | 'unavailable' | 'other'

export interface ClassifiedError {
  kind: AssistantErrorKind
  /** When the assistant may be tried again, for the kinds that block it. */
  retryAt?: Date
  /** What the admin reads. */
  message: string
  /** The model the error came from, when known. */
  modelId?: string
  /** True when our own limiter refused the request (nothing was sent to Google). */
  local?: boolean
}

interface ErrorLike {
  name?: string
  scope?: string
  retryAt?: Date
  modelId?: string
  assistantModelId?: string
  statusCode?: number
  message?: string
  responseBody?: string
  lastError?: unknown
  cause?: unknown
}

// The SDK may wrap the provider error (RetryError → lastError, or a cause).
function unwrap(err: unknown): ErrorLike[] {
  const chain: ErrorLike[] = []
  let cur: unknown = err
  for (let i = 0; i < 4 && cur && typeof cur === 'object'; i++) {
    const e = cur as ErrorLike
    chain.push(e)
    cur = e.lastError ?? e.cause
  }
  return chain
}

const MIN_RETRY_S = 5
const MAX_RETRY_S = 15 * 60
const UNKNOWN_429_RETRY_S = 5 * 60

export function classifyModelError(err: unknown, now: Date = new Date()): ClassifiedError {
  const chain = unwrap(err)
  const modelId = chain.map((e) => e.assistantModelId ?? (e.name === 'LocalQuotaError' ? e.modelId : undefined)).find((m) => typeof m === 'string')

  // Our own limiter said no: nothing was sent to Google, the message is already written.
  const local = chain.find((e) => e.name === 'LocalQuotaError')
  if (local) {
    return {
      kind: local.scope === 'daily' ? 'quota_daily' : 'rate_limit',
      retryAt: local.retryAt,
      message: local.message ?? 'Quota gratuit atteint : assistant en pause.',
      modelId,
      local: true,
    }
  }
  const status = chain.map((e) => e.statusCode).find((s) => typeof s === 'number')
  const text = chain.map((e) => `${e.message ?? ''} ${typeof e.responseBody === 'string' ? e.responseBody : ''}`).join(' ')

  const quotaLike = status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests/i.test(text)
  if (quotaLike) {
    if (/PerDay|per day|daily|requests per day/i.test(text)) {
      const retryAt = nextPacificMidnight(now)
      return {
        kind: 'quota_daily',
        retryAt,
        modelId,
        message: `Le quota gratuit quotidien de Gemini est atteint. Il se renouvelle à minuit (heure du Pacifique), soit vers ${formatLibrevilleTime(retryAt)} à Libreville. L'assistant reste en pause d'ici là : aucune facturation n'est activée.`,
      }
    }
    const hinted = /retry(?:Delay|[ _-]?after)?["':\s=in]*"?(\d+(?:\.\d+)?)\s*s/i.exec(text)
    const seconds = hinted ? Math.ceil(Number(hinted[1])) : UNKNOWN_429_RETRY_S
    const retryAt = new Date(now.getTime() + Math.min(MAX_RETRY_S, Math.max(MIN_RETRY_S, seconds)) * 1000)
    return {
      kind: 'rate_limit',
      retryAt,
      modelId,
      message: `Limite de débit gratuite de Gemini atteinte (par minute ou par jour). Réessayez vers ${formatLibrevilleTime(retryAt)}. Si cela se reproduit, le quota quotidien est épuisé : il se renouvelle à minuit, heure du Pacifique.`,
    }
  }

  if (status === 401 || status === 403 || /API key|API_KEY_INVALID|PERMISSION_DENIED|LoadAPIKey/i.test(text)) {
    return { kind: 'auth', message: "La clé API Google est absente ou refusée. Vérifiez GOOGLE_GENERATIVE_AI_API_KEY dans les variables d'environnement." }
  }
  if (status === 404 || /model.*not found|not found.*model|is not supported/i.test(text)) {
    return { kind: 'model', message: "Le modèle Gemini configuré n'est pas disponible pour cette clé. Vérifiez ASSISTANT_MODEL (modèles gratuits uniquement)." }
  }
  if ((typeof status === 'number' && status >= 500) || /UNAVAILABLE|overloaded|temporarily/i.test(text)) {
    return { kind: 'unavailable', message: 'Gemini est momentanément indisponible. Réessayez dans un instant.' }
  }
  return { kind: 'other', message: "Une erreur est survenue pendant la génération. Réessayez ; si elle persiste, consultez les journaux du serveur." }
}

/** Errors that must pause the assistant (the provider told us to stop). */
export const BLOCKING_KINDS: readonly AssistantErrorKind[] = ['quota_daily', 'rate_limit']
