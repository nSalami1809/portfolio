import { describe, expect, it } from 'vitest'
import { computeTrackSteps, type TrackStep } from '@/lib/tracking-steps'

const NOW = Date.parse('2026-03-01T12:00:00.000Z')
const day = 86_400_000
const iso = (offsetDays: number) => new Date(NOW + offsetDays * day).toISOString()

const terms = { depositPercent: 30, deliveryDays: 30, warrantyDays: 30 }
const pending = { dateEmission: iso(-5), status: 'pending' as const }

interface Over {
  terms?: typeof terms
  expired?: boolean
  deposit?: { status: 'issued' | 'paid'; paidAt?: string }
  balance?: { status: 'issued' | 'paid'; paidAt?: string }
}

const run = (quote: object, over: Over = {}) =>
  computeTrackSteps({ quote: { ...pending, ...quote } as never, terms: over.terms ?? terms, expired: over.expired ?? false, deposit: over.deposit, balance: over.balance, now: NOW })

const states = (steps: TrackStep[]) => Object.fromEntries(steps.map((s) => [s.key, s.state]))

describe('computeTrackSteps', () => {
  it('waits for the client signature on a fresh quote', () => {
    expect(states(run({}))).toEqual({
      issued: 'done', signed: 'current', deposit: 'pending', build: 'pending', delivered: 'pending', acceptance: 'pending', balance: 'pending', warranty: 'pending',
    })
  })

  it('stops everything after a declined or expired quote', () => {
    const declined = states(run({ status: 'declined' }))
    expect(declined.signed).toBe('blocked')
    expect(Object.values(declined).filter((s) => s === 'current')).toHaveLength(0)
    expect(declined.deposit).toBe('pending')

    const expired = run({}, { expired: true })
    expect(expired.find((s) => s.key === 'signed')?.data?.outcome).toBe('expired')
    expect(expired.find((s) => s.key === 'signed')?.state).toBe('blocked')
  })

  it('moves from deposit to build once the deposit is paid', () => {
    const signed = { status: 'accepted' as const, signature: { signedAt: iso(-4) } }
    expect(states(run(signed)).deposit).toBe('current')
    expect(run(signed, { deposit: { status: 'issued' } }).find((s) => s.key === 'deposit')?.data?.outcome).toBe('issued')
    const paid = run(signed, { deposit: { status: 'paid', paidAt: iso(-3) } })
    expect(states(paid).deposit).toBe('done')
    expect(states(paid).build).toBe('current')
  })

  it('skips the deposit step when the quote has no deposit', () => {
    expect(run({ status: 'accepted' }, { terms: { ...terms, depositPercent: 0 } }).map((s) => s.key)).not.toContain('deposit')
    expect(run({ status: 'accepted' }, { terms: { ...terms, depositPercent: 100 } }).map((s) => s.key)).not.toContain('deposit')
  })

  it('adds an avenant delay to the estimated build time', () => {
    const build = run({ status: 'accepted', extraDelayDays: 5 }, { deposit: { status: 'paid' } }).find((s) => s.key === 'build')
    expect(build?.data?.days).toBe(35)
  })

  it('waits for the client acceptance after delivery, then deems it given', () => {
    const waiting = run({ status: 'accepted', delivery: { deliveredAt: iso(-1) } }, { deposit: { status: 'paid' } })
    expect(states(waiting).acceptance).toBe('current')
    expect(waiting.find((s) => s.key === 'acceptance')?.data?.until).toBeTruthy()

    const old = run({ status: 'accepted', delivery: { deliveredAt: iso(-20) } }, { deposit: { status: 'paid' } })
    expect(states(old).acceptance).toBe('done')
    expect(old.find((s) => s.key === 'acceptance')?.data?.outcome).toBe('deemed')
  })

  it('records the acceptance outcome', () => {
    const clean = run({ status: 'accepted', delivery: { deliveredAt: iso(-1) }, acceptance: { signedAt: iso(0) } }, { deposit: { status: 'paid' } })
    expect(clean.find((s) => s.key === 'acceptance')?.data?.outcome).toBe('clean')
    const reserves = run({ status: 'accepted', delivery: { deliveredAt: iso(-1) }, acceptance: { signedAt: iso(0), reserves: 'x' } }, { deposit: { status: 'paid' } })
    expect(reserves.find((s) => s.key === 'acceptance')?.data?.outcome).toBe('reserves')
  })

  it('has exactly one current step while in progress, and none once everything is done', () => {
    const scenarios: [object, Over][] = [
      [{}, {}],
      [{ status: 'accepted' }, {}],
      [{ status: 'accepted' }, { deposit: { status: 'paid' } }],
      [{ status: 'accepted', delivery: { deliveredAt: iso(-1) } }, { deposit: { status: 'paid' } }],
    ]
    for (const [quote, over] of scenarios) {
      expect(run(quote, over).filter((s) => s.state === 'current')).toHaveLength(1)
    }
    const finished = run(
      { status: 'accepted', delivery: { deliveredAt: iso(-40) }, acceptance: { signedAt: iso(-39) } },
      { deposit: { status: 'paid' }, balance: { status: 'paid' } },
    )
    expect(finished.filter((s) => s.state === 'current')).toHaveLength(0)
    expect(finished.every((s) => s.state === 'done')).toBe(true)
  })

  it('drops the warranty step when there is no warranty', () => {
    expect(run({}, { terms: { ...terms, warrantyDays: 0 } }).map((s) => s.key)).not.toContain('warranty')
  })
})
