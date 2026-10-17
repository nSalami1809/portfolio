import { describe, it, expect } from 'vitest'
import { APICallError } from 'ai'
import {
  DEFAULT_ASSISTANT_MODEL, FREE_TIER_MODELS, ModelNotAllowedError, readLimits, resolveAssistantModelId, isAssistantEnabled, DEFAULT_LIMITS,
} from '@/lib/assistant/config'
import { classifyModelError, nextPacificMidnight, pacificDayKey, formatLibrevilleTime } from '@/lib/assistant/quota'

describe('free-tier model allowlist', () => {
  it('defaults to a free model', () => {
    expect(resolveAssistantModelId(undefined)).toBe(DEFAULT_ASSISTANT_MODEL)
    expect(FREE_TIER_MODELS).toContain(DEFAULT_ASSISTANT_MODEL)
  })

  it('accepts every listed free model', () => {
    for (const id of FREE_TIER_MODELS) expect(resolveAssistantModelId(id)).toBe(id)
  })

  it.each(['gemini-3.1-pro-preview', 'gemini-4-argon', 'gemini-2.5-pro', 'gpt-5', 'claude-sonnet-5-5', 'gemini-3.6-flash ; drop', 'GEMINI-3.6-FLASH'])(
    'refuses %s (not a listed free model)',
    (id) => {
      expect(() => resolveAssistantModelId(id)).toThrow(ModelNotAllowedError)
    },
  )

  it('falls back to the default for an empty value, never to an unlisted model', () => {
    expect(resolveAssistantModelId('   ')).toBe(DEFAULT_ASSISTANT_MODEL)
  })

  it('lists no model that is known to be paid-only', () => {
    expect(FREE_TIER_MODELS.some((m) => /pro/.test(m))).toBe(false)
  })
})

describe('limits', () => {
  it('uses cautious defaults', () => {
    const l = readLimits({})
    expect(l).toEqual(DEFAULT_LIMITS)
    expect(l.dailyRequests).toBeLessThanOrEqual(100)
    expect(l.perMinute).toBeLessThanOrEqual(10)
  })

  it('reads overrides and clamps nonsense', () => {
    expect(readLimits({ ASSISTANT_DAILY_REQUESTS: '120', ASSISTANT_PER_MINUTE: '6' })).toMatchObject({ dailyRequests: 120, perMinute: 6 })
    expect(readLimits({ ASSISTANT_DAILY_REQUESTS: '-5' }).dailyRequests).toBe(1)
    expect(readLimits({ ASSISTANT_DAILY_REQUESTS: 'abc' }).dailyRequests).toBe(DEFAULT_LIMITS.dailyRequests)
    expect(readLimits({ ASSISTANT_MAX_STEPS: '999' }).maxSteps).toBe(12)
  })

  it('has a kill switch', () => {
    expect(isAssistantEnabled({})).toBe(true)
    expect(isAssistantEnabled({ ASSISTANT_ENABLED: '0' })).toBe(false)
  })
})

describe('Pacific-time quota day', () => {
  it('computes the Pacific calendar day', () => {
    expect(pacificDayKey(new Date('2026-10-17T06:59:00Z'))).toBe('2026-10-16') // 23:59 PDT the day before
    expect(pacificDayKey(new Date('2026-10-17T07:00:00Z'))).toBe('2026-10-17') // midnight PDT
  })

  it('finds the next midnight (PDT, UTC-7)', () => {
    expect(nextPacificMidnight(new Date('2026-10-17T12:00:00Z')).toISOString()).toBe('2026-10-18T07:00:00.000Z')
  })

  it('finds the next midnight (PST, UTC-8)', () => {
    expect(nextPacificMidnight(new Date('2026-12-10T12:00:00Z')).toISOString()).toBe('2026-12-11T08:00:00.000Z')
  })

  it('handles the autumn clock change (25-hour day)', () => {
    // 2026-11-01: PDT → PST. Midnight of Nov 2 is 08:00Z.
    expect(nextPacificMidnight(new Date('2026-11-01T12:00:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z')
  })

  it('handles the spring clock change (23-hour day)', () => {
    // 2027-03-14: PST → PDT. Midnight of Mar 15 is 07:00Z.
    expect(nextPacificMidnight(new Date('2027-03-14T12:00:00Z')).toISOString()).toBe('2027-03-15T07:00:00.000Z')
  })

  it('never returns a time before or equal to the input', () => {
    const from = new Date('2026-10-17T06:59:59Z')
    expect(nextPacificMidnight(from).getTime()).toBeGreaterThan(from.getTime())
  })

  it('shows the renewal time in Libreville (UTC+1)', () => {
    expect(formatLibrevilleTime(new Date('2026-10-18T07:00:00Z'))).toBe('08:00')
  })
})

const NOW = new Date('2026-10-17T12:00:00Z')

function apiError(statusCode: number, message: string, responseBody = '') {
  return new APICallError({ message, url: 'https://example.test', requestBodyValues: {}, statusCode, responseBody })
}

describe('classifyModelError', () => {
  it('recognises the daily free quota and waits for the Pacific midnight', () => {
    const c = classifyModelError(apiError(429, 'You exceeded your current quota', '{"error":{"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded for metric: generate_content_free_tier_requests, limit: 250, PerDay"}}'), NOW)
    expect(c.kind).toBe('quota_daily')
    expect(c.retryAt?.toISOString()).toBe('2026-10-18T07:00:00.000Z')
    expect(c.message).toMatch(/minuit/)
    expect(c.message).toMatch(/aucune facturation/i)
  })

  it('reads the retry delay of a per-minute limit', () => {
    const c = classifyModelError(apiError(429, 'Rate limit', '{"error":{"status":"RESOURCE_EXHAUSTED","details":[{"retryDelay":"37s"}]}}'), NOW)
    expect(c.kind).toBe('rate_limit')
    expect(c.retryAt?.getTime()).toBe(NOW.getTime() + 37_000)
  })

  it('treats an unexplained 429 as a pause of a few minutes, never as success', () => {
    const c = classifyModelError(apiError(429, 'Too many requests'), NOW)
    expect(c.kind).toBe('rate_limit')
    expect(c.retryAt!.getTime() - NOW.getTime()).toBe(5 * 60_000)
  })

  it('caps an absurd retry delay', () => {
    const c = classifyModelError(apiError(429, 'x', '{"retryDelay":"99999s"}'), NOW)
    expect(c.retryAt!.getTime() - NOW.getTime()).toBeLessThanOrEqual(15 * 60_000)
  })

  it('sees through a wrapped error (retry wrapper / cause)', () => {
    const wrapped = Object.assign(new Error('Failed after 3 attempts'), { lastError: apiError(429, 'quota', 'PerDay') })
    expect(classifyModelError(wrapped, NOW).kind).toBe('quota_daily')
    const caused = new Error('boom', { cause: apiError(429, 'quota', 'PerDay') })
    expect(classifyModelError(caused, NOW).kind).toBe('quota_daily')
  })

  it('classifies key, model and availability problems without pausing', () => {
    expect(classifyModelError(apiError(403, 'API key not valid'), NOW).kind).toBe('auth')
    expect(classifyModelError(apiError(404, 'models/gemini-x is not found'), NOW).kind).toBe('model')
    expect(classifyModelError(apiError(503, 'The model is overloaded'), NOW).kind).toBe('unavailable')
    for (const status of [401, 404, 503]) expect(classifyModelError(apiError(status, 'x'), NOW).retryAt).toBeUndefined()
  })

  it('never leaks the raw provider message for an unknown error', () => {
    const c = classifyModelError(new Error('secret internal detail: key=AIza123'), NOW)
    expect(c.kind).toBe('other')
    expect(c.message).not.toMatch(/AIza|secret/)
  })
})
