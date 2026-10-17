import { NextResponse } from 'next/server'
import { fetchPortfolioSafe } from '@/lib/portfolio-data'
import { defaultDocuments } from '@/data/defaultData'

// A document's fileUrl is a Vercel Blob URL on its own subdomain
// (…public.blob.vercel-storage.com) — cross-origin from the site itself, so
// the HTML `download` attribute on a plain <a href={fileUrl}> is silently
// ignored by most browsers and the visitor ends up with the storage host's
// own (random-suffixed) filename instead of a real download. Proxying
// through this same-origin route with an explicit Content-Disposition is
// what actually forces a save with the document's real name — same fix as
// /api/cv. Restrict fetches to the Blob host so this can never become an
// open proxy/SSRF relay.
const ALLOWED_HOST_RE = /(^|\.)public\.blob\.vercel-storage\.com$/

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const portfolio = await fetchPortfolioSafe('api/documents/download')
  const documents = portfolio?.documents ?? defaultDocuments
  const document = documents.find((d) => d.slug === slug)
  if (!document) {
    return new NextResponse('Document introuvable', { status: 404 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(document.fileUrl)
  } catch {
    return new NextResponse('Document introuvable', { status: 404 })
  }
  if (parsedUrl.protocol !== 'https:' || !ALLOWED_HOST_RE.test(parsedUrl.hostname)) {
    return new NextResponse('Document introuvable', { status: 404 })
  }

  // Blob URLs are content-addressed and immutable, so re-fetching the same
  // bytes from origin on every download is pure waste. Tagged 'portfolio' so
  // replacing the file in the admin invalidates it immediately.
  const upstream = await fetch(parsedUrl, {
    next: { tags: ['portfolio'], revalidate: 3600 },
  }).catch(() => null)
  if (!upstream || !upstream.ok || !upstream.body) {
    return new NextResponse('Erreur lors de la récupération du document', { status: 502 })
  }

  const contentType = document.fileType === 'pdf'
    ? 'application/pdf'
    : document.fileType === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/msword'

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${document.fileName}"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
