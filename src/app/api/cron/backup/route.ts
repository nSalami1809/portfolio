import { NextRequest, NextResponse } from 'next/server'
import { createBackup, latestBackupAt } from '@/lib/backup'
import { isAuthorizedCron } from '@/lib/cron-auth'

// Weekly encrypted database backup (see vercel.json). Same CRON_SECRET rule as
// the other cron routes.
export const maxDuration = 120

const MIN_HOURS_BETWEEN_CRON_BACKUPS = 6

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Weekly job: a second backup within hours is never wanted, and each one pushes the
    // oldest of the KEEP_BACKUPS out. ("Sauvegarder maintenant" in the admin is not limited.)
    const last = await latestBackupAt()
    if (last && Date.now() - last.getTime() < MIN_HOURS_BETWEEN_CRON_BACKUPS * 3_600_000) return NextResponse.json({ ok: true, skipped: true })

    const result = await createBackup()
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    // Nothing about the content (sizes, collection names) in an answer to a caller.
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[cron/backup]', e)
    return NextResponse.json({ ok: false, error: 'Erreur interne' }, { status: 500 })
  }
}
