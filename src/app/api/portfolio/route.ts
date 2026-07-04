import { NextResponse } from 'next/server'
import { fetchPortfolio } from '@/actions/portfolio'

export const revalidate = 15

export async function GET() {
  try {
    const data = await fetchPortfolio()
    const res = NextResponse.json({ data: data ?? null })
    // 15s shared cache + 30s stale-while-revalidate for public visitors
    res.headers.set('Cache-Control', 's-maxage=15, stale-while-revalidate=30')
    return res
  } catch {
    return NextResponse.json({ data: null })
  }
}
