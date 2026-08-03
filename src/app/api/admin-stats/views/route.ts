import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { isStatsRange } from '@/lib/admin-stats'
import { getViewsStats } from '@/lib/admin-stats-data'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('admin-token')?.value
  if (!token) return false
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
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
