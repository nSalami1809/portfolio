export function compressImage(file: File, maxSide: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))),
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')) }
    img.src = url
  })
}

export async function uploadFile(file: File | Blob, filename: string): Promise<string> {
  const form = new FormData()
  form.append('file', file, filename)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? "Échec de l'upload")
  }
  const { url } = await res.json()
  return url as string
}

export function deleteUploadedFile(url: string) {
  if (!url.includes('.public.blob.vercel-storage.com')) return
  fetch(`/api/upload?url=${encodeURIComponent(url)}`, { method: 'DELETE' }).catch(() => {})
}
