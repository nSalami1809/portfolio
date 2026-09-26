import { NextResponse } from 'next/server'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo, defaultOffers } from '@/data/defaultData'
import { generateSampleDocument, SAMPLE_KINDS, type SampleKind } from '@/lib/sample-documents'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

// Public, read-only sample documents (fictional client, "EXEMPLE" watermark) —
// see lib/sample-documents.ts. Cached at the CDN: they only change when the
// provider edits the settings, and a few minutes of staleness is harmless.
export async function GET(_req: Request, { params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params
  const kind = (SAMPLE_KINDS as readonly string[]).includes(doc) ? (doc as SampleKind) : null
  if (!kind) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const portfolio = await fetchPortfolioSafe('api/exemples')
  try {
    const { filename, content } = await generateSampleDocument(kind, portfolio?.personal ?? defaultPersonalInfo, portfolio?.offers ?? defaultOffers, SITE_URL)
    return new NextResponse(new Uint8Array(content), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (e) {
    console.error('[api/exemples] generation failed:', e)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
