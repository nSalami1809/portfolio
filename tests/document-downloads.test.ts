import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRecountGuard, isBot } from '@/lib/download-guard'

const root = join(__dirname, '..', 'src')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('which visitors count', () => {
  it('leaves out crawlers, link previews, monitors and headless browsers', () => {
    for (const ua of [
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'WhatsApp/2.23.20 A',
      'facebookexternalhit/1.1',
      'TelegramBot (like TwitterBot)',
      'Mozilla/5.0 HeadlessChrome/120',
      'Mozilla/5.0 (compatible; UptimeRobot/2.0; monitor)',
      'Mozilla/5.0 Chrome-Lighthouse',
      'Slackbot-LinkExpanding 1.0 (preview)',
    ]) expect(isBot(ua), ua).toBe(true)
  })

  it('counts an ordinary browser, and a request with no user agent at all', () => {
    expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')).toBe(false)
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1')).toBe(false)
    expect(isBot('')).toBe(false)
    expect(isBot(null)).toBe(false)
    expect(isBot(undefined)).toBe(false)
  })
})

describe('the same visitor fetching the same file again', () => {
  it('counts once within the window, and again after it', () => {
    const fresh = createRecountGuard(10 * 60_000)
    const t0 = 1_000_000
    expect(fresh('1.2.3.4:cv', t0)).toBe(true)
    expect(fresh('1.2.3.4:cv', t0 + 1_000)).toBe(false)
    expect(fresh('1.2.3.4:cv', t0 + 9 * 60_000)).toBe(false)
    expect(fresh('1.2.3.4:cv', t0 + 10 * 60_000)).toBe(true)
  })

  it('keeps other visitors and other files apart', () => {
    const fresh = createRecountGuard()
    expect(fresh('1.2.3.4:cv', 0)).toBe(true)
    expect(fresh('5.6.7.8:cv', 0)).toBe(true)
    expect(fresh('1.2.3.4:rapport', 0)).toBe(true)
  })

  it('does not grow without limit', () => {
    const fresh = createRecountGuard(60_000, 50)
    for (let i = 0; i < 500; i++) expect(fresh(`ip${i}:doc`, i)).toBe(true)
    // after being full it started afresh instead of growing: an old key is counted again, not remembered forever
    expect(fresh('ip0:doc', 600)).toBe(true)
  })
})

describe('the download route', () => {
  const route = read('app/api/documents/[slug]/download/route.ts')

  it('counts after the document is known to be going out, never before a 404 or a failed fetch', () => {
    const count = route.indexOf('recordDocumentDownload(slug)')
    expect(count).toBeGreaterThan(-1)
    expect(count).toBeGreaterThan(route.indexOf("'Document introuvable'"))
    expect(count).toBeGreaterThan(route.indexOf('Erreur lors de la récupération du document'))
  })

  it('counts without making the visitor wait', () => {
    expect(route).toMatch(/after\(\(\) => recordDocumentDownload\(slug\)\)/)
  })

  it('counts only people, and a new download of that file from that visitor', () => {
    expect(route).toMatch(/!isBot\(req\.headers\.get\('user-agent'\)\) && isNewDownload\(/)
    expect(route).toContain('createRecountGuard()')
  })

  it('still serves the file as before: same host restriction, same attachment header', () => {
    expect(route).toContain('ALLOWED_HOST_RE')
    expect(route).toContain("'Content-Disposition': `attachment; filename=\"${document.fileName}\"`")
  })
})

describe('what is stored', () => {
  const lib = read('lib/document-downloads.ts')

  it('is a slug and a date, nothing about the visitor', () => {
    expect(lib).toMatch(/insertOne\(\{ slug: slug\.slice\(0, 200\), createdAt: new Date\(\) \}\)/)
    // the comments say what is NOT kept: only the code itself is checked
    const code = lib.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/\b(?:ip|userAgent|user-agent|cookie|headers?)\b/i)
  })

  it('expires on its own after 400 days, like the page views', () => {
    expect(lib).toContain('expireAfterSeconds: TTL_SECONDS')
    expect(lib).toContain('400 * 86_400')
  })

  it('never lets a counting error reach the visitor', () => {
    expect(lib).toMatch(/catch \{\s*\/\/ Never let a counting hiccup reach the visitor/)
  })

  it('is only ever imported on the server', () => {
    expect(lib.startsWith("import 'server-only'")).toBe(true)
  })
})

describe('in the back-office', () => {
  it('is read through an action that checks the admin session first', () => {
    const action = read('actions/document-stats.ts')
    expect(action.startsWith("'use server'")).toBe(true)
    expect(action).toMatch(/getDocumentDownloadCounts\(\)[^{]*\{\s*await requireAdmin\(\)/)
  })

  it('shows the number under each document, with the 30-day detail on hover, like the blog list shows its views', () => {
    const page = read('app/admin/documents/page.tsx')
    expect(page).toContain('data-testid="download-count"')
    expect(page).toContain('<Icon name="download" size={11} />')
    expect(page).toMatch(/dont \$\{\(downloads\[d\.slug\]\?\.last30Days \?\? 0\)/)
    expect(page).toMatch(/getDocumentDownloadCounts\(\)\s*\.then/)
  })

  it('shares its robot filter with the page-view beacon, so both count the same kind of visitor', () => {
    expect(read('app/api/track-visit/route.ts')).toContain("import { isBot } from '@/lib/download-guard'")
  })
})
