import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── /admin/login ─────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin/login')) {
    const jwtToken = req.cookies.get('admin-token')?.value

    // Déjà connecté → dashboard
    if (jwtToken) {
      try {
        await jwtVerify(jwtToken, getSecret())
        return NextResponse.redirect(new URL('/admin', req.url))
      } catch { /* token invalide, continuer */ }
    }

    // Accès autorisé uniquement avec le cookie admin-pre (posé par /api/admin-gate)
    const preAuth = req.cookies.get('admin-pre')?.value
    if (preAuth === '1') return NextResponse.next()

    return new NextResponse(null, { status: 404 })
  }

  // ── /admin/verify ────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin/verify')) {
    const preAuth = req.cookies.get('admin-pre')?.value
    if (!preAuth) return new NextResponse(null, { status: 404 })
    return NextResponse.next()
  }

  // ── Reste de /admin/* ────────────────────────────────────────────────────
  const jwtToken = req.cookies.get('admin-token')?.value
  if (!jwtToken) return new NextResponse(null, { status: 404 })

  try {
    await jwtVerify(jwtToken, getSecret())
    return NextResponse.next()
  } catch {
    const res = new NextResponse(null, { status: 404 })
    res.cookies.delete('admin-token')
    return res
  }
}

export const config = {
  matcher: ['/admin/:path*'],
}
