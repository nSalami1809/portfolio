import { NextResponse } from 'next/server'
import { fetchPortfolioSafe } from '@/actions/portfolio'

// Builds a clean "FirstLast.pdf" filename from the admin's full name —
// derived from data instead of hardcoded, so it stays correct if the name
// ever changes (e.g. "Nawaf Nemrod Salami" -> "NawafSalami.pdf").
// Combining diacritical marks block (U+0300-U+036F), built from char codes to
// avoid embedding literal combining characters directly in source.
const DIACRITICS_RE = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g')
const NON_ALNUM_RE = /[^a-zA-Z0-9]/g

function cvFileName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const short = parts.length > 1 ? `${parts[0]}${parts[parts.length - 1]}` : (parts[0] ?? 'CV')
  const safe = short.normalize('NFD').replace(DIACRITICS_RE, '').replace(NON_ALNUM_RE, '')
  return `${safe || 'CV'}.pdf`
}

// The CV URL is admin-set today (publishPortfolio is auth-gated), but this
// route otherwise fetches whatever URL the stored document holds and streams
// the body straight back to any visitor — a ready-made server-side fetch
// primitive if the CMS is ever compromised. Restrict it to the actual Blob
// storage host so it can never be turned into an open proxy/SSRF relay.
const ALLOWED_CV_HOST_RE = /(^|\.)public\.blob\.vercel-storage\.com$/

export async function GET() {
  const portfolio = await fetchPortfolioSafe('api/cv')
  const cvUrl = portfolio?.personal.cvUrl
  if (!cvUrl) {
    return new NextResponse('CV non disponible', { status: 404 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(cvUrl)
  } catch {
    return new NextResponse('CV non disponible', { status: 404 })
  }
  if (parsedUrl.protocol !== 'https:' || !ALLOWED_CV_HOST_RE.test(parsedUrl.hostname)) {
    return new NextResponse('CV non disponible', { status: 404 })
  }

  // Blob URLs are content-addressed and immutable, so re-fetching the same
  // bytes from origin on every download was pure waste. Tagged 'portfolio' so
  // uploading a new CV in the admin invalidates it immediately rather than
  // waiting out the hour.
  const upstream = await fetch(parsedUrl, {
    next: { tags: ['portfolio'], revalidate: 3600 },
  }).catch(() => null)
  if (!upstream || !upstream.ok || !upstream.body) {
    return new NextResponse('Erreur lors de la récupération du CV', { status: 502 })
  }

  const filename = cvFileName(portfolio?.personal.name || 'CV')

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': 'application/pdf',
      // Content-Disposition is what makes this a download rather than an
      // inline view, so it has to stay on the response even now that the
      // response itself is cacheable at the edge.
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
