import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/locale'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

function getPreferredLocale(req: NextRequest): string {
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value
  if (cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)) return cookieLocale
  const acceptLanguage = req.headers.get('accept-language') ?? ''
  if (acceptLanguage.toLowerCase().startsWith('en')) return 'en'
  return DEFAULT_LOCALE
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Non-locale system routes: never touched by locale redirection ───────
  if (
    pathname.startsWith('/api') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/opengraph-image') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

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
  if (pathname.startsWith('/admin')) {
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

  // ── Public routes: enforce a /fr or /en prefix ──────────────────────────
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  if (hasLocale) return NextResponse.next()

  const locale = getPreferredLocale(req)
  const url = req.nextUrl.clone()
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
  const res = NextResponse.redirect(url)
  if (!req.cookies.get('NEXT_LOCALE')) {
    res.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
