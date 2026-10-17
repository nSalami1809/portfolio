import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-token'
import { put, del } from '@vercel/blob'
import sharp from 'sharp'

// Keeps only characters that are safe in a Blob path segment — strips any
// `/`, `..`, or other path-altering sequence out of the client-supplied
// filename so it can never escape the `images/`/`videos/`/`documents/`
// prefix it's interpolated into below.
function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '')
  return cleaned.slice(-150) || 'file'
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 30 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

// Word (.doc/.docx) added alongside PDF for the Documents feature — the
// Content-Type header alone is attacker-controlled, so sniffMagicBytes()
// below double-checks against the file's actual signature.
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

// .docx is a zip (PK\x03\x04); legacy .doc is an OLE compound file
// (D0 CF 11 E0). Checking the real bytes instead of trusting file.type
// stops a renamed/mislabeled file from slipping past validation.
async function sniffMagicBytes(file: File): Promise<boolean> {
  const head = Buffer.from(await file.slice(0, 8).arrayBuffer())
  if (file.type === 'application/pdf') return head.subarray(0, 4).toString('latin1') === '%PDF'
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  }
  if (file.type === 'application/msword') {
    return head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0
  }
  return false
}

const DOCUMENT_EXTENSION: Record<string, 'pdf' | 'docx' | 'doc'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
}

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
    return { body: compressed, filename: sanitizeFilename(file.name).replace(/\.[^./]+$/, '') + '.webp' }
  } catch (e) {
    console.error('[upload] compression échouée, envoi du fichier original:', e)
    return null
  }
}

async function requireAdmin(req: NextRequest) {
  return verifyAdminToken(req.cookies.get('admin-token')?.value)
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
  const isDocument = DOCUMENT_MIME_TYPES.has(file.type)
  if (!isImage && !isVideo && !isDocument) {
    return NextResponse.json({ error: 'Type de fichier non supporté' }, { status: 400 })
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : isDocument ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `Fichier trop lourd (max ${Math.round(maxBytes / 1024 / 1024)} Mo)` }, { status: 400 })
  }

  if (isDocument && !(await sniffMagicBytes(file))) {
    return NextResponse.json({ error: 'Le contenu du fichier ne correspond pas au type déclaré' }, { status: 400 })
  }

  const compressed = isImage ? await compressImage(file) : null

  const folder = isVideo ? 'videos' : isDocument ? 'documents' : 'images'
  const filename = compressed?.filename ?? sanitizeFilename(file.name)
  const blob = await put(`${folder}/${Date.now()}-${filename}`, compressed?.body ?? file, {
    access: 'public',
    addRandomSuffix: true,
  })

  return NextResponse.json({
    url: blob.url,
    size: compressed?.body.length ?? file.size,
    name: filename,
    ...(isDocument ? { fileType: DOCUMENT_EXTENSION[file.type] } : {}),
  })
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
