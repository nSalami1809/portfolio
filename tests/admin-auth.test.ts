import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SECRET = 'unit-test-secret-at-least-16-chars'
process.env.JWT_SECRET = SECRET

// An in-memory stand-in for the one MongoDB collection the OTP code touches. It
// implements the filter operators used there with the same all-or-nothing
// semantics as a single Mongo operation.
const fake = vi.hoisted(() => {
  type Doc = { _id: number; email: string; otpHash?: string; otp?: string; attempts: number; expiresAt: Date }
  const docs: Doc[] = []
  let nextId = 1
  const col = {
    createIndex: async () => 'ok',
    updateOne: async (filter: { email: string }, update: { $set?: Partial<Doc>; $unset?: Record<string, unknown> }, opts?: { upsert?: boolean }) => {
      let d = docs.find((x) => x.email === filter.email)
      if (!d && opts?.upsert) { d = { _id: nextId++, email: filter.email, attempts: 0, expiresAt: new Date(0) }; docs.push(d) }
      if (d) {
        Object.assign(d, update.$set ?? {})
        for (const k of Object.keys(update.$unset ?? {})) delete (d as Record<string, unknown>)[k]
      }
      return {}
    },
    findOneAndUpdate: async (filter: { email: string; attempts: { $lt: number }; expiresAt: { $gt: Date } }, update: { $inc: { attempts: number } }) => {
      const d = docs.find((x) => x.email === filter.email && x.attempts < filter.attempts.$lt && x.expiresAt > filter.expiresAt.$gt)
      if (!d) return null
      d.attempts += update.$inc.attempts
      return { ...d }
    },
    deleteOne: async (filter: { _id: number }) => {
      const i = docs.findIndex((x) => x._id === filter._id)
      if (i >= 0) docs.splice(i, 1)
      return { deletedCount: i >= 0 ? 1 : 0 }
    },
  }
  return { docs, col }
})
vi.mock('@/lib/mongodb', () => ({ getDb: async () => ({ collection: () => fake.col }) }))

import { PRE_AUTH_TTL_MS, signPreAuth, verifyPreAuth } from '@/lib/admin-pre'
import { consumeOTP, storeOTP } from '@/lib/otp'

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0)

describe('admin-pre cookie', () => {
  it('accepts a freshly signed value', async () => {
    expect(await verifyPreAuth(await signPreAuth(NOW), NOW + 1000)).toBe(true)
  })

  it('expires', async () => {
    const v = await signPreAuth(NOW)
    expect(await verifyPreAuth(v, NOW + PRE_AUTH_TTL_MS - 1)).toBe(true)
    expect(await verifyPreAuth(v, NOW + PRE_AUTH_TTL_MS)).toBe(false)
    expect(await verifyPreAuth(v, NOW + 24 * 3600_000)).toBe(false)
  })

  it('rejects the old constant value and other hand-made values', async () => {
    for (const v of ['1', 'true', '', undefined, null, '.', 'abc.def', `${NOW + 60_000}.`, `${NOW + 60_000}.${'0'.repeat(64)}`, 'x'.repeat(500)]) {
      expect(await verifyPreAuth(v as string | undefined, NOW), String(v)).toBe(false)
    }
  })

  it('rejects a tampered expiry or signature', async () => {
    const v = await signPreAuth(NOW)
    const [exp, sig] = v.split('.')
    expect(await verifyPreAuth(`${Number(exp) + 3600_000}.${sig}`, NOW)).toBe(false) // extended lifetime
    expect(await verifyPreAuth(`${exp}.${sig.replace(/.$/, sig.endsWith('0') ? '1' : '0')}`, NOW)).toBe(false)
    expect(await verifyPreAuth(`${exp}.${sig}00`, NOW)).toBe(false)
  })

  it('rejects a value signed with another secret', async () => {
    const exp = NOW + 60_000
    const forged = `${exp}.${createHmac('sha256', 'some-other-secret-entirely').update(`admin-pre:${exp}`).digest('hex')}`
    expect(await verifyPreAuth(forged, NOW)).toBe(false)
    const genuine = `${exp}.${createHmac('sha256', SECRET).update(`admin-pre:${exp}`).digest('hex')}`
    expect(await verifyPreAuth(genuine, NOW)).toBe(true) // same construction, right secret
  })

  it('cannot be confused with an admin session token (and vice versa)', async () => {
    const v = await signPreAuth(NOW)
    expect(v.split('.').length).toBe(2) // a JWT has three parts, so jwtVerify() refuses it as admin-token
    const jwtShaped = `eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYWRtaW4ifQ.${'a'.repeat(43)}`
    expect(await verifyPreAuth(jwtShaped, NOW)).toBe(false)
  })
})

describe('admin login code (OTP)', () => {
  beforeEach(() => { fake.docs.length = 0 })
  const email = 'admin@example.com'

  it('accepts the right code once, and only once', async () => {
    await storeOTP(email, '123456')
    expect(await consumeOTP(email, '123456')).toBe(true)
    expect(await consumeOTP(email, '123456')).toBe(false)
  })

  it('refuses a wrong code and keeps the right one valid', async () => {
    await storeOTP(email, '123456')
    expect(await consumeOTP(email, '654321')).toBe(false)
    expect(await consumeOTP(email, '123456')).toBe(true)
  })

  it('locks the code after 5 tries, even for the right code', async () => {
    await storeOTP(email, '123456')
    for (let i = 0; i < 5; i++) expect(await consumeOTP(email, `00000${i}`)).toBe(false)
    expect(await consumeOTP(email, '123456')).toBe(false)
  })

  it('counts a burst of parallel guesses against the same 5 tries', async () => {
    await storeOTP(email, '123456')
    // 200 simultaneous guesses, the right code hidden among them at position 150.
    const guesses = Array.from({ length: 200 }, (_, i) => (i === 150 ? '123456' : String(100000 + i)))
    const results = await Promise.all(guesses.map((g) => consumeOTP(email, g)))
    expect(fake.docs[0]?.attempts ?? 5).toBeLessThanOrEqual(5)
    expect(results.filter(Boolean).length).toBe(0) // position 150 was never one of the first 5 tries
  })

  it('refuses an expired code', async () => {
    await storeOTP(email, '123456')
    fake.docs[0].expiresAt = new Date(Date.now() - 1000)
    expect(await consumeOTP(email, '123456')).toBe(false)
  })

  it('never stores the code itself', async () => {
    await storeOTP(email, '123456')
    expect(JSON.stringify(fake.docs)).not.toContain('123456')
    expect(fake.docs[0].otpHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('replaces the previous code and resets the counter on a new login', async () => {
    await storeOTP(email, '111111')
    await consumeOTP(email, '000000')
    await storeOTP(email, '222222')
    expect(fake.docs).toHaveLength(1)
    expect(fake.docs[0].attempts).toBe(0)
    expect(await consumeOTP(email, '111111')).toBe(false)
    expect(await consumeOTP(email, '222222')).toBe(true)
  })

  it('still accepts a code stored in the old plaintext format (valid for 60 s at most)', async () => {
    fake.docs.push({ _id: 99, email, otp: '777777', attempts: 0, expiresAt: new Date(Date.now() + 30_000) })
    expect(await consumeOTP(email, '777777')).toBe(true)
  })

  it('is bound to the account: the same code does not open another email', async () => {
    await storeOTP(email, '123456')
    expect(await consumeOTP('other@example.com', '123456')).toBe(false)
  })
})

describe('quote lookups use the private access code only', () => {
  const quotes = readFileSync(join(__dirname, '..', 'src', 'actions', 'quotes.ts'), 'utf8')
  const body = (name: string) => {
    const start = quotes.indexOf(`export async function ${name}(`)
    const next = quotes.indexOf('\nexport ', start + 10)
    return quotes.slice(start, next < 0 ? undefined : next)
  }

  it.each(['lookupQuote', 'sendQuoteEmail', 'downloadQuotePdf'])('%s never searches by the sequential quote number', (name) => {
    const code = body(name)
    expect(code).toContain('accessCode')
    expect(code).not.toMatch(/numero:\s*ref|\{\s*numero\b|\$or:\s*\[\s*\{\s*numero/)
  })

  it('does not tell the chatbot to accept a quote number', () => {
    const chat = readFileSync(join(__dirname, '..', 'src', 'app', 'api', 'chat', 'route.ts'), 'utf8')
    expect(chat).not.toMatch(/Numéro de devis \(ex: DEV-2026-002\) ou code/)
    expect(chat).toMatch(/CODE D'ACCÈS/)
  })
})
