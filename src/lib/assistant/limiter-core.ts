// The request limiter, free of any database: it decides, for ONE request about to
// be sent to ONE model, whether Google's free-tier limits (per minute and per
// day, per model) leave room for it. Every request counts — a tool call or a
// second step of the same conversation turn is a request like any other, which is
// what Google counts. When the minute is full it waits for the next one (briefly);
// when the day is full, or Google already said stop, it refuses without calling
// Google at all.
import { formatLibrevilleTime, nextPacificMidnight, pacificDayKey } from '@/lib/assistant/quota'
import type { FreeLimits } from '@/lib/assistant/config'

export type LocalQuotaScope = 'daily' | 'minute' | 'blocked'

export class LocalQuotaError extends Error {
  constructor(
    public readonly modelId: string,
    public readonly scope: LocalQuotaScope,
    public readonly retryAt: Date,
    message: string,
  ) {
    super(message)
    this.name = 'LocalQuotaError'
  }
}

export interface LimiterStore {
  /** Takes one slot of the given minute if fewer than `cap` are taken. */
  takeMinute(modelId: string, minuteIndex: number, cap: number): Promise<boolean>
  /** Takes one slot of the given Pacific day if fewer than `cap` are taken. */
  takeDay(modelId: string, dayKey: string, cap: number): Promise<boolean>
  /** A pause ordered by Google's own 429 answer, if still running. */
  getBlock(modelId: string): Promise<{ until: Date; message: string } | null>
}

export interface AcquireOptions {
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  /** Longest total wait for a free minute before giving up. */
  maxWaitMs?: number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function acquireRequest(store: LimiterStore, modelId: string, caps: FreeLimits, opts: AcquireOptions = {}): Promise<void> {
  const now = opts.now ?? (() => new Date())
  const sleep = opts.sleep ?? defaultSleep
  const maxWaitMs = opts.maxWaitMs ?? 20_000

  const block = await store.getBlock(modelId)
  if (block && block.until.getTime() > now().getTime()) throw new LocalQuotaError(modelId, 'blocked', block.until, block.message)

  let waited = 0
  for (;;) {
    const t = now()
    const minute = Math.floor(t.getTime() / 60_000)
    if (await store.takeMinute(modelId, minute, caps.rpm)) break
    const nextMinute = (minute + 1) * 60_000
    const waitMs = nextMinute - t.getTime() + 50
    if (waited + waitMs > maxWaitMs) {
      throw new LocalQuotaError(modelId, 'minute', new Date(nextMinute), `Trop de requêtes en une minute pour ${modelId} (maximum ${caps.rpm}, marge de sécurité incluse). Réessaie dans quelques secondes.`)
    }
    await sleep(waitMs)
    waited += waitMs
  }

  const day = pacificDayKey(now())
  if (!(await store.takeDay(modelId, day, caps.rpd))) {
    const retryAt = nextPacificMidnight(now())
    throw new LocalQuotaError(
      modelId, 'daily', retryAt,
      `Quota gratuit du jour atteint pour ${modelId} (${caps.rpd} requêtes, marge de sécurité incluse). Il se renouvelle à minuit, heure du Pacifique, soit vers ${formatLibrevilleTime(retryAt)} à Libreville. Aucune facturation n'est activée.`,
    )
  }
}
