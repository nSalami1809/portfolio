'use client'

import { pdfjs } from './pdfjs-worker'

// Renders a PDF's first page to a PNG blob entirely client-side — either
// right after the admin picks a new file in DocumentUpload, or (source then
// being an already-uploaded file re-fetched from its Blob URL) as a one-off
// backfill for documents added before thumbnails existed. Runs once at
// upload/backfill time, not on every visitor's page load. The result is
// then uploaded through the existing /api/upload image pipeline, same as
// any other cover image.
export async function renderPdfThumbnail(source: Blob, maxWidth = 600): Promise<Blob | null> {
  try {
    const data = await source.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data }).promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: maxWidth / base.width })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  } catch {
    return null
  }
}
