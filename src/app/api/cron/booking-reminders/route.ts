import { NextRequest, NextResponse } from 'next/server'
import { sendDueReminders } from '@/actions/bookings'
import { isAuthorizedCron } from '@/lib/cron-auth'

// Invoked by Vercel Cron (see vercel.json). Vercel automatically sends
// `Authorization: Bearer ${CRON_SECRET}` for scheduled invocations once that env
// var is set; anything else is refused (see lib/cron-auth.ts).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const result = await sendDueReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron/booking-reminders]', e)
    return NextResponse.json({ ok: false, error: 'Erreur interne' }, { status: 500 })
  }
}
