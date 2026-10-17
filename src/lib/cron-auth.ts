import { createHash, timingSafeEqual } from 'node:crypto'

// Who may trigger the scheduled jobs (api/cron/*). Vercel sends
// `Authorization: Bearer <CRON_SECRET>` on every scheduled run once CRON_SECRET is
// set as an environment variable of the project. Anyone else is refused.
//
// The routes used to skip the check when CRON_SECRET was missing, "so the job still
// runs before the secret is set up". That left them open to the whole internet:
// their paths are in the public repository, and one call starts a full database
// backup (and, eight calls later, has pushed every older backup out) or sends the
// clients' reminder e-mails ahead of time. In production a missing secret now means
// "refuse", loudly; only a local `next dev` (no secret, not production) is let through.
export function isAuthorizedCron(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.CRON_SECRET
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      console.error('[cron] CRON_SECRET is not set: scheduled jobs are refused until it is (Vercel → Settings → Environment Variables).')
      return false
    }
    return true
  }
  // Hash both sides first: timingSafeEqual needs equal lengths, and the length of the
  // secret must not leak through an early exit.
  const given = createHash('sha256').update(req.headers.get('authorization') ?? '').digest()
  const wanted = createHash('sha256').update(`Bearer ${secret}`).digest()
  return timingSafeEqual(given, wanted)
}
