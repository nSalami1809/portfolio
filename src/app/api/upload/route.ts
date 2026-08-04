import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { put, del } from '@vercel/blob'
import sharp from 'sharp'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 30 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

// Every uploaded photo (avatar, project shot, blog cover, inline blog
// image…) gets capped and re-encoded here, once, at upload time — so
// nothing depends on whichever page later happens to display it with
// next/image vs a plain <img>. GIF and SVG are left untouched: sharp only
// keeps a GIF's first frame unless told otherwise (would silently kill
// the animation), and SVG is already vector/lightweight.
const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const MAX_IMAGE_DIMENSION = 2400
const WEBP_QUALITY = 82

async function compressImage(file: File): Promise<{ body: Buffer; filename: string } | null> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) return null
  try {
    const original = Buffer.from(await file.arrayBuffer())
    const compressed = await sharp(original)
      .rotate() // bake in EXIF orientation before the metadata that carries it is stripped
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()
    // A tiny already-optimized image can occasionally grow slightly once
    // re-encoded — only swap it in when it's actually a real improvement.
    if (compressed.length >= original.length) return null
    return { body: compressed, filename: file.name.replace(/\.[^./]+$/, '') + '.webp' }
  } catch (e) {
    console.error('[upload] compression échouée, envoi du fichier original:', e)
    return null
  }
}

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
  const isDocument = file.type === 'application/pdf'
  if (!isImage && !isVideo && !isDocument) {
    return NextResponse.json({ error: 'Type de fichier non supporté' }, { status: 400 })
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : isDocument ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `Fichier trop lourd (max ${Math.round(maxBytes / 1024 / 1024)} Mo)` }, { status: 400 })
  }

  const compressed = isImage ? await compressImage(file) : null

  const folder = isVideo ? 'videos' : isDocument ? 'documents' : 'images'
  const filename = compressed?.filename ?? file.name
  const blob = await put(`${folder}/${Date.now()}-${filename}`, compressed?.body ?? file, {
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
