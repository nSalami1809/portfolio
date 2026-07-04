import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { put, del } from '@vercel/blob'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 30 * 1024 * 1024

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

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  }

  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'Type de fichier non supporté' }, { status: 400 })
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `Fichier trop lourd (max ${Math.round(maxBytes / 1024 / 1024)} Mo)` }, { status: 400 })
  }

  const folder = isVideo ? 'videos' : 'images'
  const blob = await put(`${folder}/${Date.now()}-${file.name}`, file, {
    access: 'public',
    addRandomSuffix: true,
  })

  return NextResponse.json({ url: blob.url })
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const url = req.nextUrl.searchParams.get('url')
  if (!url || !url.includes('.public.blob.vercel-storage.com')) {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
  }

  await del(url).catch(() => {})
  return NextResponse.json({ ok: true })
}
