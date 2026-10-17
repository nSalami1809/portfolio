import { NextRequest, NextResponse } from 'next/server'
import { runReminders } from '@/lib/reminders-run'
import { isAuthorizedCron } from '@/lib/cron-auth'

// Invoked daily by Vercel Cron (see vercel.json); same CRON_SECRET rule as the
// booking reminders. Whether reminders are on at all is a setting of the admin
// (Réglages > Automatisation), checked inside runReminders.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const report = await runReminders()
    // Counts only: the report lines name clients and quote numbers.
    return NextResponse.json({ ok: true, enabled: report.enabled, planned: report.planned, sent: report.sent.length, failed: report.failed.length })
  } catch (e) {
    console.error('[cron/reminders]', e)
    return NextResponse.json({ ok: false, error: 'Erreur interne' }, { status: 500 })
  }
}
