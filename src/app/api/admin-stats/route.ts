import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-token'
import { getOverviewStats } from '@/lib/admin-stats-data'

async function requireAdmin(req: NextRequest) {
  return verifyAdminToken(req.cookies.get('admin-token')?.value)
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  return NextResponse.json(await getOverviewStats())
}
