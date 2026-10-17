import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { APICallError } from 'ai'
import { LocalQuotaError, acquireRequest, type LimiterStore } from '@/lib/assistant/limiter-core'
import { effectiveCaps } from '@/lib/assistant/config'
import { classifyModelError, nextPacificMidnight, pacificDayKey } from '@/lib/assistant/quota'

// An in-memory store with the same all-or-nothing "+1 if under the cap" step as the
// MongoDB one, and a clock the tests move by hand.
function fakeWorld(start = '2026-10-17T10:00:30Z') {
  let t = new Date(start).getTime()
  const minutes = new Map<string, number>()
  const days = new Map<string, number>()
  const blocks = new Map<string, { until: Date; message: string }>()
  const sleeps: number[] = []
  const store: LimiterStore = {
    takeMinute: async (m, i, cap) => { const k = `${m}:${i}`; const n = minutes.get(k) ?? 0; if (n >= cap) return false; minutes.set(k, n + 1); return true },
    takeDay: async (m, d, cap) => { const k = `${m}:${d}`; const n = days.get(k) ?? 0; if (n >= cap) return false; days.set(k, n + 1); return true },
    getBlock: async (m) => blocks.get(m) ?? null,
  }
  return {
    store, minutes, days, blocks, sleeps,
    opts: { now: () => new Date(t), sleep: async (ms: number) => { sleeps.push(ms); t += ms } },
    advance: (ms: number) => { t += ms },
    now: () => new Date(t),
    dayCount: (model: string) => days.get(`${model}:${pacificDayKey(new Date(t))}`) ?? 0,
  }
}

const LITE = 'gemini-3.1-flash-lite'
const WRITER = 'gemini-3.6-flash'

describe('acquireRequest', () => {
  it('counts every request against the model\'s minute and day', async () => {
    const w = fakeWorld()
    for (let i = 0; i < 3; i++) await acquireRequest(w.store, LITE, effectiveCaps(LITE), w.opts)
    expect(w.dayCount(LITE)).toBe(3)
    expect([...w.minutes.values()]).toEqual([3])
    expect(w.sleeps).toEqual([])
  })

  it('waits for the next minute when this one is full, then goes through', async () => {
    const w = fakeWorld('2026-10-17T10:00:50Z') // 10 s left in the minute
    const caps = effectiveCaps(WRITER) // 4 per minute
    for (let i = 0; i < 4; i++) await acquireRequest(w.store, WRITER, caps, w.opts)
    expect(w.sleeps).toEqual([])
    await acquireRequest(w.store, WRITER, caps, w.opts) // the 5th: the minute is full
    expect(w.sleeps).toHaveLength(1)
    expect(w.sleeps[0]).toBeGreaterThan(9_000)
    expect(w.sleeps[0]).toBeLessThan(11_000)
    expect(w.dayCount(WRITER)).toBe(5)
  })

  it('gives up instead of waiting for too long', async () => {
    const w = fakeWorld('2026-10-17T10:00:05Z') // 55 s left in the minute
    const caps = { rpm: 1, rpd: 100 }
    await acquireRequest(w.store, LITE, caps, w.opts)
    await expect(acquireRequest(w.store, LITE, caps, { ...w.opts, maxWaitMs: 20_000 })).rejects.toMatchObject({ name: 'LocalQuotaError', scope: 'minute' })
    expect(w.sleeps).toEqual([]) // it did not sleep a minute inside a request
    expect(w.dayCount(LITE)).toBe(1) // and the refused request used no daily slot
  })

  it('refuses once the day\'s cap is reached, with the renewal time and no billing', async () => {
    const w = fakeWorld()
    const caps = { rpm: 100, rpd: 3 }
    for (let i = 0; i < 3; i++) await acquireRequest(w.store, LITE, caps, w.opts)
    const err = (await acquireRequest(w.store, LITE, caps, w.opts).then(() => null, (e: unknown) => e)) as LocalQuotaError
    expect(err).toBeInstanceOf(LocalQuotaError)
    expect(err).toMatchObject({ scope: 'daily', modelId: LITE })
    expect(err.retryAt.toISOString()).toBe(nextPacificMidnight(w.now()).toISOString())
    expect(err.message).toMatch(/minuit/)
    expect(err.message).toMatch(/Aucune facturation/)
  })

  it('refuses without taking any slot while Google\'s own pause is running, and ignores an expired one', async () => {
    const w = fakeWorld()
    w.blocks.set(LITE, { until: new Date(w.now().getTime() + 60_000), message: 'Pause ordonnée par Google.' })
    await expect(acquireRequest(w.store, LITE, effectiveCaps(LITE), w.opts)).rejects.toMatchObject({ scope: 'blocked', message: 'Pause ordonnée par Google.' })
    expect(w.minutes.size).toBe(0)
    expect(w.dayCount(LITE)).toBe(0)
    w.advance(61_000)
    await acquireRequest(w.store, LITE, effectiveCaps(LITE), w.opts)
    expect(w.dayCount(LITE)).toBe(1)
  })

  it('keeps one bucket per model: exhausting one leaves the other untouched', async () => {
    const w = fakeWorld()
    const capsWriter = effectiveCaps(WRITER)
    for (let i = 0; i < capsWriter.rpd; i++) {
      w.advance(60_000) // spread over minutes so only the daily cap speaks
      await acquireRequest(w.store, WRITER, capsWriter, w.opts)
    }
    await expect(acquireRequest(w.store, WRITER, capsWriter, w.opts)).rejects.toMatchObject({ scope: 'daily' })
    await acquireRequest(w.store, LITE, effectiveCaps(LITE), w.opts) // the chat model is still free
    expect(w.dayCount(LITE)).toBe(1)
  })

  it('lets exactly the cap through when many requests arrive at once', async () => {
    const w = fakeWorld()
    const caps = { rpm: 1000, rpd: 20 }
    const results = await Promise.allSettled(Array.from({ length: 35 }, () => acquireRequest(w.store, WRITER, caps, w.opts)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(20)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(15)
    expect(w.dayCount(WRITER)).toBe(20)
  })

  it('starts a new day at midnight Pacific', async () => {
    const w = fakeWorld('2026-10-18T06:59:00Z') // 23:59 PDT
    const caps = { rpm: 100, rpd: 1 }
    await acquireRequest(w.store, LITE, caps, w.opts)
    await expect(acquireRequest(w.store, LITE, caps, w.opts)).rejects.toMatchObject({ scope: 'daily' })
    w.advance(2 * 60_000) // 00:01 PDT
    await acquireRequest(w.store, LITE, caps, w.opts)
    expect(w.dayCount(LITE)).toBe(1)
  })
})

describe('how the limiter\'s refusals and Google\'s answers are told apart', () => {
  it('our own refusal is "local": it names the model and must not create a pause', () => {
    const e = new LocalQuotaError(WRITER, 'daily', new Date('2026-10-18T07:00:00Z'), 'Quota du jour atteint.')
    expect(classifyModelError(e)).toMatchObject({ kind: 'quota_daily', local: true, modelId: WRITER, message: 'Quota du jour atteint.' })
    expect(classifyModelError(new LocalQuotaError(LITE, 'minute', new Date(), 'Trop vite.'))).toMatchObject({ kind: 'rate_limit', local: true })
  })

  it('a 429 from Google is not local, and carries the model that received it', () => {
    const e = new APICallError({ message: 'quota', url: 'https://x.test', requestBodyValues: {}, statusCode: 429, responseBody: 'RESOURCE_EXHAUSTED PerDay' })
    Object.defineProperty(e, 'assistantModelId', { value: WRITER })
    const c = classifyModelError(e, new Date('2026-10-17T12:00:00Z'))
    expect(c).toMatchObject({ kind: 'quota_daily', modelId: WRITER })
    expect(c.local).toBeUndefined()
  })
})

describe('every request goes through the limiter', () => {
  const dir = join(__dirname, '..', 'src', 'lib', 'assistant')
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && statSync(join(dir, f)).isFile())
  const read = (f: string) => readFileSync(join(dir, f), 'utf8')

  it('only models.ts talks to the provider, and both models are wrapped', () => {
    for (const f of files) {
      if (f === 'models.ts') continue
      expect(read(f), f).not.toMatch(/@ai-sdk\/google|\bgoogle\(/)
    }
    const models = read('models.ts')
    expect((models.match(/limitModel\(google\(/g) ?? []).length).toBe(2)
  })

  it('the wrapper counts both single calls and streams', () => {
    const limiter = read('limiter.ts')
    expect(limiter).toMatch(/wrapGenerate[\s\S]*await gate\(\)/)
    expect(limiter).toMatch(/wrapStream[\s\S]*await gate\(\)/)
  })

  it('writing uses the writer model; translating, documents and conversations use the chat model', () => {
    const gen = read('draft-generation.ts')
    for (const fn of ['writeBlogArticle', 'reviseBlogFields', 'rewriteField']) {
      const body = gen.slice(gen.indexOf(`export async function ${fn}(`))
      expect(body.slice(0, body.indexOf('\n}\n')), fn).toContain('env.writerModel')
    }
    expect(gen.slice(gen.indexOf('export async function translateFields('))).toMatch(/model: env\.model/)
    expect(read('analysis.ts')).not.toMatch(/writerModel/)
  })

  it('there is no per-turn counter left that could disagree with the limiter', () => {
    for (const f of files) expect(read(f), f).not.toMatch(/UsageMeter|canSpend|dailyRequests/)
  })
})
