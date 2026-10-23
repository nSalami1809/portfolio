'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { compressImage, uploadFile } from '@/lib/upload'
import { MAX_PROJECT_IMAGES, galleryCapacity, moveItem } from '@/lib/project-gallery'

const MAX_MB = 8
const MAX_SIDE = 1400
const TILE = 96

// The extra pictures of a project, under its cover: add (several at once), remove,
// move. Same upload as the cover (compressed in the browser, then Vercel Blob), at a
// larger size so screenshots stay readable. Nothing is deleted from Blob here: like
// the cover, a change is only form state until the project is saved.
export default function GalleryEditor({ cover, value, onChange }: { cover?: string; value: string[]; onChange: (urls: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const capacity = galleryCapacity(cover)
  const total = value.length + (cover ? 1 : 0)
  const room = capacity - value.length - busy

  const addFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const accepted = files.slice(0, Math.max(0, room))
    const problems: string[] = []
    if (files.length > accepted.length) problems.push(`Limite de ${MAX_PROJECT_IMAGES} images par projet : ${files.length - accepted.length} image(s) ignorée(s).`)

    setBusy(accepted.length)
    const urls: string[] = []
    // One after the other: the browser compresses on the main thread and /api/upload is not meant for a burst.
    for (const file of accepted) {
      if (!file.type.startsWith('image/')) { problems.push(`« ${file.name} » n'est pas une image.`); continue }
      if (file.size > MAX_MB * 1024 * 1024) { problems.push(`« ${file.name} » est trop lourd (max ${MAX_MB} Mo).`); continue }
      try {
        const blob = await compressImage(file, MAX_SIDE)
        urls.push(await uploadFile(blob, file.name.replace(/\.[^.]+$/, '.jpg')))
      } catch {
        problems.push(`Échec de l'envoi de « ${file.name} ».`)
      }
    }
    setBusy(0)
    if (urls.length) onChange([...value, ...urls].slice(0, capacity))
    if (problems.length) setError(problems.join(' '))
  }

  const buttonStyle = { width: 28, height: 28, padding: 0 } as const

  return (
    <div data-testid="gallery-editor">
      <p className="field-label">Galerie du projet</p>
      <p className="text-xs mb-2" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
        <span data-testid="gallery-count">{total} / {MAX_PROJECT_IMAGES}</span> images (couverture comprise). Visibles sur la page du projet, dans l&apos;ordre ci-dessous, après la couverture.
      </p>
      <ul className="flex flex-wrap gap-3 list-none p-0 m-0">
        {value.map((url, i) => (
          <li key={url} data-testid="gallery-item" style={{ width: TILE }}>
            <div className="relative" style={{ width: TILE, height: TILE, border: '2px solid var(--border)' }}>
              <Image src={url} alt={`Image ${i + 2} de la galerie`} fill sizes={`${TILE}px`} style={{ objectFit: 'cover' }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="flex gap-1">
                <button type="button" className="btn-secondary btn-xs inline-flex items-center justify-center" style={buttonStyle} disabled={i === 0} onClick={() => onChange(moveItem(value, i, i - 1))} aria-label={`Déplacer l'image ${i + 1} vers le début`} title="Vers le début" data-testid="gallery-left">←</button>
                <button type="button" className="btn-secondary btn-xs inline-flex items-center justify-center" style={buttonStyle} disabled={i === value.length - 1} onClick={() => onChange(moveItem(value, i, i + 1))} aria-label={`Déplacer l'image ${i + 1} vers la fin`} title="Vers la fin" data-testid="gallery-right">→</button>
              </span>
              <button type="button" className="btn-danger btn-xs inline-flex items-center justify-center" style={buttonStyle} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Retirer l'image ${i + 1} de la galerie`} title="Retirer" data-testid="gallery-remove">✕</button>
            </div>
          </li>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <li key={`busy-${i}`} className="flex items-center justify-center" style={{ width: TILE, height: TILE, border: '2px dashed var(--border)' }} aria-busy="true">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          </li>
        ))}
        {room > 0 && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Ajouter des images à la galerie"
              data-testid="gallery-add"
              className="flex flex-col items-center justify-center gap-1 text-xs"
              style={{ width: TILE, height: TILE, border: '2px dashed var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
            >
              <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>+</span>
              Ajouter
            </button>
          </li>
        )}
      </ul>
      {error && <p className="text-xs mt-2" role="alert" style={{ color: '#D90000', fontFamily: 'var(--font-poppins)' }}>{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={addFiles} aria-label="Choisir des images pour la galerie" className="sr-only" tabIndex={-1} data-testid="gallery-input" />
    </div>
  )
}
