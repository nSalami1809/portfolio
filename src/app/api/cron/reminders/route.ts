import { NextRequest, NextResponse } from 'next/server'
import { runReminders } from '@/lib/reminders-run'

// Invoked daily by Vercel Cron (see vercel.json); same CRON_SECRET rule as the
// booking reminders. Whether reminders are on at all is a setting of the admin
// (Réglages > Automatisation), checked inside runReminders.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const report = await runReminders()
    return NextResponse.json({ ok: true, ...report })
  } catch (e) {
    console.error('[cron/reminders]', e)
    return NextResponse.json({ ok: false, error: 'Erreur interne' }, { status: 500 })
  }
}
