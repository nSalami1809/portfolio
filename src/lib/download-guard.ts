// What decides whether a download counts. The counter is a signal about real people reading the
// site's documents, so robots (crawlers, link previews, monitors) are left out, and the same
// visitor fetching the same file again within a few minutes (a refresh, a double click) counts once.
// Nothing about the visitor is kept: the key lives in memory for the window, never in the database.

export const BOT_RE = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|headless|pingdom|lighthouse/i

export function isBot(userAgent: string | null | undefined): boolean {
  return BOT_RE.test(userAgent ?? '')
}

/**
 * A function that says, for a key (visitor + file), whether this download is a new one.
 * Per server instance and best effort, like the page-view throttle: it is not a hard guarantee,
 * only enough to keep a refresh from inflating the number. The memory is bounded.
 */
export function createRecountGuard(windowMs = 10 * 60_000, maxKeys = 5_000) {
  const seen = new Map<string, number>()
  return (key: string, now: number = Date.now()): boolean => {
    const last = seen.get(key)
    if (last !== undefined && now - last < windowMs) return false
    if (seen.size >= maxKeys) {
      // drop what has expired; if the table is still full, start afresh rather than grow
      for (const [k, at] of seen) if (now - at >= windowMs) seen.delete(k)
      if (seen.size >= maxKeys) seen.clear()
    }
    seen.set(key, now)
    return true
  }
}
