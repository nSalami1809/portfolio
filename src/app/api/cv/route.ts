import { NextResponse } from 'next/server'
import { fetchPortfolio } from '@/actions/portfolio'

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

export async function GET() {
  const portfolio = await fetchPortfolio().catch(() => null)
  const cvUrl = portfolio?.personal.cvUrl
  if (!cvUrl) {
    return new NextResponse('CV non disponible', { status: 404 })
  }

  const upstream = await fetch(cvUrl).catch(() => null)
  if (!upstream || !upstream.ok || !upstream.body) {
    return new NextResponse('Erreur lors de la récupération du CV', { status: 502 })
  }

  const filename = cvFileName(portfolio?.personal.name || 'CV')

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
