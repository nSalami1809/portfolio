import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { SignJWT } from 'jose'

const SECRET = 'unit-test-secret-at-least-16-chars'
process.env.JWT_SECRET = SECRET

import { isAuthorizedCron } from '@/lib/cron-auth'
import { verifyAdminToken } from '@/lib/admin-token'

const req = (authorization?: string) => new Request('https://example.test/api/cron/backup', { headers: authorization === undefined ? {} : { authorization } })

describe('isAuthorizedCron', () => {
  const env = { CRON_SECRET: 'a-long-random-cron-secret-value-0123456789', NODE_ENV: 'production' }

  it('accepts the exact bearer token Vercel sends', () => {
    expect(isAuthorizedCron(req(`Bearer ${env.CRON_SECRET}`), env)).toBe(true)
  })

  it.each([
    ['no header', undefined],
    ['empty header', ''],
    ['wrong secret', 'Bearer not-the-secret'],
    ['secret without the scheme', 'a-long-random-cron-secret-value-0123456789'],
    ['another scheme', 'Basic a-long-random-cron-secret-value-0123456789'],
    ['secret with a suffix', 'Bearer a-long-random-cron-secret-value-0123456789x'],
    ['secret cut short', 'Bearer a-long-random-cron-secret-value-012345678'],
    ['lower-cased scheme', 'bearer a-long-random-cron-secret-value-0123456789'],
    ['extra space', 'Bearer  a-long-random-cron-secret-value-0123456789'],
  ])('refuses %s', (_label, header) => {
    expect(isAuthorizedCron(req(header), env)).toBe(false)
  })

  it('in production a missing secret means REFUSE, never "let everyone in"', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    for (const header of [undefined, 'Bearer', 'Bearer undefined', 'Bearer ', 'Bearer null']) {
      expect(isAuthorizedCron(req(header), { NODE_ENV: 'production' })).toBe(false)
      expect(isAuthorizedCron(req(header), { NODE_ENV: 'production', CRON_SECRET: '' })).toBe(false)
    }
    expect(spy).toHaveBeenCalled() // and it says why
    spy.mockRestore()
  })

  it('only a local run (not production) may go without a secret', () => {
    expect(isAuthorizedCron(req(), { NODE_ENV: 'development' })).toBe(true)
    expect(isAuthorizedCron(req(), {})).toBe(true)
  })

  it('a configured secret is enforced in development too', () => {
    expect(isAuthorizedCron(req(), { NODE_ENV: 'development', CRON_SECRET: 'x'.repeat(40) })).toBe(false)
  })
})

describe('the cron routes', () => {
  const dir = join(__dirname, '..', 'src', 'app', 'api', 'cron')
  const routes = readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).map((n) => ({ name: n, text: readFileSync(join(dir, n, 'route.ts'), 'utf8').replace(/\r\n/g, '\n').replace(/^\s*\/\/.*$/gm, '') }))

  it('there are three, and each one starts with the shared check', () => {
    expect(routes.map((r) => r.name).sort()).toEqual(['backup', 'booking-reminders', 'reminders'])
    for (const r of routes) {
      expect(r.text, r.name).toMatch(/isAuthorizedCron\(req\)/)
      expect(r.text.indexOf('isAuthorizedCron(req)'), r.name).toBeLessThan(r.text.search(/await (createBackup|runReminders|sendDueReminders|latestBackupAt)/))
      expect(r.text, r.name).not.toMatch(/CRON_SECRET/) // no private copy of the rule that could drift
      expect(r.text, r.name).not.toMatch(/if \(secret &&/)
    }
  })

  it('answers a caller with counts only: no client names, no collection names', () => {
    const reminders = routes.find((r) => r.name === 'reminders')!.text
    expect(reminders).not.toMatch(/\.\.\.report/)
    expect(reminders).toMatch(/sent: report\.sent\.length/)
    const backup = routes.find((r) => r.name === 'backup')!.text
    expect(backup).not.toMatch(/collections|size/)
  })

  it('the backup job refuses to run twice within hours', () => {
    const backup = routes.find((r) => r.name === 'backup')!.text
    expect(backup).toMatch(/latestBackupAt\(\)/)
    expect(backup).toMatch(/MIN_HOURS_BETWEEN_CRON_BACKUPS\s*=\s*6/)
    expect(backup.indexOf('latestBackupAt()')).toBeLessThan(backup.indexOf('createBackup()'))
  })

  it('the manual backup of the admin is not affected by that limit', () => {
    const action = readFileSync(join(__dirname, '..', 'src', 'actions', 'backups.ts'), 'utf8')
    expect(action).not.toMatch(/latestBackupAt/)
  })
})

const sign = (payload: Record<string, unknown>, opts: { secret?: string; alg?: string; exp?: string } = {}) =>
  new SignJWT(payload).setProtectedHeader({ alg: opts.alg ?? 'HS256' }).setIssuedAt().setExpirationTime(opts.exp ?? '1h').sign(new TextEncoder().encode(opts.secret ?? SECRET))

describe('verifyAdminToken', () => {
  it('accepts a genuine admin session', async () => {
    expect(await verifyAdminToken(await sign({ role: 'admin' }))).toBe(true)
  })

  it('refuses a token signed with our secret but not carrying the admin role', async () => {
    expect(await verifyAdminToken(await sign({}))).toBe(false)
    expect(await verifyAdminToken(await sign({ role: 'user' }))).toBe(false)
    expect(await verifyAdminToken(await sign({ pre: true }))).toBe(false)
    expect(await verifyAdminToken(await sign({ role: ['admin'] }))).toBe(false)
  })

  it('refuses expired, foreign-secret and other-algorithm tokens', async () => {
    expect(await verifyAdminToken(await sign({ role: 'admin' }, { exp: '-1m' }))).toBe(false)
    expect(await verifyAdminToken(await sign({ role: 'admin' }, { secret: 'another-secret-with-enough-length' }))).toBe(false)
    expect(await verifyAdminToken(await sign({ role: 'admin' }, { alg: 'HS512' }))).toBe(false)
  })

  it('refuses garbage, an empty value and the unsigned "none" algorithm', async () => {
    for (const t of [undefined, null, '', 'abc', 'a.b.c', '1', 'eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.']) expect(await verifyAdminToken(t as string | undefined), String(t)).toBe(false)
  })

  it('refuses the cookie that only opens the login pages', async () => {
    const { signPreAuth } = await import('@/lib/admin-pre')
    expect(await verifyAdminToken(await signPreAuth())).toBe(false)
  })
})

describe('one guard for the whole back-office', () => {
  const ROOT = join(__dirname, '..', 'src')
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]))
  const sources = walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => ({ f: f.slice(ROOT.length + 1).split('\\').join('/'), text: readFileSync(f, 'utf8') }))

  it('only admin-token.ts verifies a session token', () => {
    expect(sources.filter((s) => /jwtVerify\(/.test(s.text)).map((s) => s.f)).toEqual(['lib/admin-token.ts'])
  })

  it('the proxy, the server actions guard and every admin API route use it', () => {
    for (const f of ['proxy.ts', 'lib/require-admin.ts', 'app/api/admin-export/route.ts', 'app/api/admin-notifications/route.ts', 'app/api/admin-stats/route.ts', 'app/api/admin-stats/views/route.ts', 'app/api/upload/route.ts']) {
      expect(sources.find((s) => s.f === f)?.text, f).toMatch(/verifyAdminToken\(/)
    }
  })

  it('the public chatbot limits by the trustworthy client address, not the leftmost forwarded hop', () => {
    const chat = sources.find((s) => s.f === 'app/api/chat/route.ts')!.text
    expect(chat).toMatch(/clientIpFromHeaders\(req\.headers\)/)
    expect(chat).not.toMatch(/get\('x-forwarded-for'\)/)
  })
})
