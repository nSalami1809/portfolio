import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireAdmin } from '@/lib/require-admin'
import { backupsCol } from '@/lib/backup'

// Same fix as /api/cv and /api/documents/[slug]/download: a backup's `url`
// is a Vercel Blob URL on its own subdomain, so a plain <a href={url}
// download> is silently ignored by most browsers on a cross-origin target —
// the admin got the storage host's raw filename instead of a real download.
// Proxying through this same-origin, admin-gated route with an explicit
// Content-Disposition is what actually forces the save. Host-restricted so
// this can never become an open proxy/SSRF relay.
const ALLOWED_HOST_RE = /(^|\.)public\.blob\.vercel-storage\.com$/

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch {
    return new NextResponse('Non autorisé', { status: 401 })
  }

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return new NextResponse('Sauvegarde introuvable', { status: 404 })
  }

  const col = await backupsCol()
  const record = await col.findOne({ _id: new ObjectId(id) })
  if (!record) {
    return new NextResponse('Sauvegarde introuvable', { status: 404 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(record.url)
  } catch {
    return new NextResponse('Sauvegarde introuvable', { status: 404 })
  }
  if (parsedUrl.protocol !== 'https:' || !ALLOWED_HOST_RE.test(parsedUrl.hostname)) {
    return new NextResponse('Sauvegarde introuvable', { status: 404 })
  }

  const upstream = await fetch(parsedUrl).catch(() => null)
  if (!upstream || !upstream.ok || !upstream.body) {
    return new NextResponse('Erreur lors de la récupération de la sauvegarde', { status: 502 })
  }

  const dateStr = record.createdAt.toISOString().slice(0, 10)
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="backup-${dateStr}.enc"`,
    },
  })
}
