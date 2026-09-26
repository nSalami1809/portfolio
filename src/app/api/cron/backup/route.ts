import { NextRequest, NextResponse } from 'next/server'
import { createBackup } from '@/lib/backup'

// Weekly encrypted database backup (see vercel.json). Same CRON_SECRET rule as
// the other cron routes.
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const result = await createBackup()
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    return NextResponse.json({ ok: true, size: result.record.size, collections: result.record.collections })
  } catch (e) {
    console.error('[cron/backup]', e)
    return NextResponse.json({ ok: false, error: 'Erreur interne' }, { status: 500 })
  }
}
