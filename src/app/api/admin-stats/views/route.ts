import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-token'
import { isStatsRange } from '@/lib/admin-stats'
import { getViewsStats } from '@/lib/admin-stats-data'

async function requireAdmin(req: NextRequest) {
  return verifyAdminToken(req.cookies.get('admin-token')?.value)
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const rangeParam = searchParams.get('range') ?? '14d'
  const range = isStatsRange(rangeParam) ? rangeParam : '14d'
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  return NextResponse.json(await getViewsStats(range, offset))
}
