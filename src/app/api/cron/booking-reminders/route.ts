import { NextRequest, NextResponse } from 'next/server'
import { sendDueReminders } from '@/actions/bookings'

// Invoked by Vercel Cron (see vercel.json). Vercel automatically sends
// `Authorization: Bearer ${CRON_SECRET}` for scheduled invocations when
// that env var is set — enforced only if it's actually configured, so the
// job still runs before the secret is set up rather than 401ing forever.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const result = await sendDueReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron/booking-reminders]', e)
    return NextResponse.json({ ok: false, error: 'Erreur interne' }, { status: 500 })
  }
}
