import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Every export of a 'use server' file is a Server Action: reachable by a direct
// POST, whatever page happens to render the calling component. Next's own docs
// are explicit that each one must check access itself. This test keeps that true
// as the code grows: an action either starts with requireAdmin() or is on the
// explicit list of public actions below (each one gated by a private code, a
// signed token, a rate limit, or credentials, by design).

const ROOT = join(__dirname, '..', 'src')
const ACTIONS_DIR = join(ROOT, 'actions')

// file → public action names. Adding to this list is a security decision.
const PUBLIC_ACTIONS: Record<string, string[]> = {
  'auth.ts': ['loginWithCredentials', 'verifyOTPAction', 'logout'],
  'bookings.ts': ['getMonthSlots', 'getDaySchedule', 'getUpcomingAvailability', 'bookMeeting', 'lookupBooking', 'cancelBooking', 'sendDueReminders'],
  'chat-feedback.ts': ['rateChatMessage'],
  'client-space.ts': ['requestRevision'],
  'contact.ts': ['submitContact'],
  'escalation.ts': ['requestHumanHelp'],
  'lifecycle.ts': ['getAcceptanceByToken', 'signAcceptance'],
  'offers.ts': ['getPublicOffers'],
  'quotes.ts': ['submitQuote', 'lookupQuote', 'downloadQuotePdf', 'sendQuoteEmail', 'getQuoteByToken', 'requestSignatureCode', 'signQuote', 'declineQuote'],
  'testimonials.ts': ['submitTestimonial'],
  'tracking.ts': ['getProjectTracking'],
  'waitlist.ts': ['joinWaitlist', 'notifyWaitlist'],
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

interface ExportedAction { name: string; body: string }

function exportedActions(source: string): ExportedAction[] {
  const re = /^export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=)/gm
  const marks: { name: string; start: number }[] = []
  for (let m = re.exec(source); m; m = re.exec(source)) marks.push({ name: m[1] ?? m[2], start: m.index })
  const nextExport = /^export\s/gm
  return marks.map((mark) => {
    nextExport.lastIndex = mark.start + 1
    const next = nextExport.exec(source)
    return { name: mark.name, body: source.slice(mark.start, next ? next.index : source.length) }
  })
}

const actionFiles = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts'))

describe('server actions — access control', () => {
  for (const file of actionFiles) {
    const source = readFileSync(join(ACTIONS_DIR, file), 'utf8')
    if (!/^['"]use server['"]/m.test(source)) continue
    const publicNames = new Set(PUBLIC_ACTIONS[file] ?? [])

    describe(file, () => {
      const actions = exportedActions(source)

      for (const { name, body } of actions) {
        if (publicNames.has(name)) continue
        it(`${name} checks requireAdmin() before anything else`, () => {
          const admin = body.indexOf('await requireAdmin()')
          expect(admin, `${file}:${name} is neither on the public list nor guarded`).toBeGreaterThan(-1)
          // The guard must be the first thing that is awaited.
          expect(body.slice(0, admin).includes('await '), `${file}:${name} awaits something before requireAdmin()`).toBe(false)
        })
      }

      it('has no stale entry in the public list', () => {
        const names = new Set(actions.map((a) => a.name))
        for (const n of publicNames) expect(names.has(n), `${file}: ${n} is listed as public but no longer exported`).toBe(true)
      })
    })
  }

  it('lists no public actions for a file that does not exist', () => {
    for (const file of Object.keys(PUBLIC_ACTIONS)) expect(actionFiles).toContain(file)
  })
})

describe('portfolio reads', () => {
  const sources = walk(ROOT)
    .filter((p) => /\.(ts|tsx)$/.test(p))
    .map((p) => ({ path: p.slice(ROOT.length + 1).split('\\').join('/'), text: readFileSync(p, 'utf8') }))

  it('no Server Action exports the unguarded server-side readers', () => {
    for (const { path, text } of sources) {
      if (!/^['"]use server['"]/m.test(text)) continue
      expect(text, path).not.toMatch(/^export\s+(?:async\s+function|const)\s+fetchPortfolio(?:Fresh|Safe)?\b/m)
    }
  })

  it('the readers live in lib/portfolio-data and are server-only', () => {
    const data = sources.find((s) => s.path === 'lib/portfolio-data.ts')
    expect(data).toBeDefined()
    expect(data!.text).toMatch(/^import ['"]server-only['"]/m)
    expect(data!.text).not.toMatch(/^['"]use server['"]/m)
  })

  it('nothing imports the readers from the actions file', () => {
    for (const { path, text } of sources) {
      expect(text, path).not.toMatch(/import\s*\{[^}]*\bfetchPortfolio(?:Fresh|Safe)?\b[^}]*\}\s*from\s*['"]@\/actions\/portfolio['"]/)
    }
  })

  it('no client component imports the server-side readers', () => {
    for (const { path, text } of sources) {
      if (!/^\s*['"]use client['"]/.test(text)) continue
      expect(text, path).not.toMatch(/from\s*['"]@\/lib\/portfolio-data['"]/)
    }
  })

  it('the back-office wrappers are guarded', () => {
    const actions = sources.find((s) => s.path === 'actions/portfolio.ts')!
    for (const name of ['publishPortfolio', 'fetchPortfolioForAdmin', 'fetchPortfolioFreshForAdmin']) {
      const body = exportedActions(actions.text).find((a) => a.name === name)?.body
      expect(body, name).toContain('await requireAdmin()')
    }
  })
})
