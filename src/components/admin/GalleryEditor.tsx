'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { compressImage, uploadFile } from '@/lib/upload'
import { moveItem } from '@/lib/project-gallery'

const MAX_MB = 8
const MAX_SIDE = 1400

interface Props {
  /** Heading of the block ("Galerie ordinateur"…). */
  label: string
  /** One line under the heading, after the count. */
  hint: string
  value: string[]
  onChange: (urls: string[]) => void
  /** How many pictures this block may hold. */
  capacity: number
  /** Pictures counted next to this block's own (the cover), and the total the visitor-facing limit is stated on. */
  alreadyCounted?: number
  limit: number
  /** Phone screenshots: tall tiles, shown whole. */
  portrait?: boolean
  /** Prefix of the data-testid attributes. */
  id?: string
}

// The extra pictures of a project: add (several at once), remove, move. Same upload
// as the cover (compressed in the browser, then Vercel Blob), at a larger size so
// screenshots stay readable. Nothing is deleted from Blob here: like the cover, a
// change is only form state until the project is saved.
export default function GalleryEditor({ label, hint, value, onChange, capacity, alreadyCounted = 0, limit, portrait = false, id = 'gallery' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const tile = portrait ? { width: 72, height: 128 } : { width: 96, height: 96 }
  const total = value.length + alreadyCounted
  const room = capacity - value.length - busy

  const addFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const accepted = files.slice(0, Math.max(0, room))
    const problems: string[] = []
    if (files.length > accepted.length) problems.push(`Limite de ${limit} images : ${files.length - accepted.length} image(s) ignorée(s).`)

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
    <div data-testid={`${id}-editor`}>
      <p className="field-label">{label}</p>
      <p className="text-xs mb-2" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
        <span data-testid={`${id}-count`}>{total} / {limit}</span> {hint}
      </p>
      <ul className="flex flex-wrap gap-3 list-none p-0 m-0">
        {value.map((url, i) => (
          <li key={url} data-testid={`${id}-item`} style={{ width: Math.max(tile.width + 4, 100) }}>
            <div className="relative" style={{ width: tile.width, height: tile.height, border: '2px solid var(--border)', background: 'var(--surface-hover)', boxSizing: 'content-box' }}>
              <Image src={url} alt={`${label} — image ${i + 1}`} fill sizes={`${tile.width}px`} style={{ objectFit: portrait ? 'contain' : 'cover' }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="flex gap-1">
                <button type="button" className="btn-secondary btn-xs inline-flex items-center justify-center" style={buttonStyle} disabled={i === 0} onClick={() => onChange(moveItem(value, i, i - 1))} aria-label={`Déplacer l'image ${i + 1} vers le début`} title="Vers le début" data-testid={`${id}-left`}>←</button>
                <button type="button" className="btn-secondary btn-xs inline-flex items-center justify-center" style={buttonStyle} disabled={i === value.length - 1} onClick={() => onChange(moveItem(value, i, i + 1))} aria-label={`Déplacer l'image ${i + 1} vers la fin`} title="Vers la fin" data-testid={`${id}-right`}>→</button>
              </span>
              <button type="button" className="btn-danger btn-xs inline-flex items-center justify-center" style={buttonStyle} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Retirer l'image ${i + 1}`} title="Retirer" data-testid={`${id}-remove`}>✕</button>
            </div>
          </li>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <li key={`busy-${i}`} className="flex items-center justify-center" style={{ width: tile.width, height: tile.height, border: '2px dashed var(--border)' }} aria-busy="true">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          </li>
        ))}
        {room > 0 && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={`Ajouter des images : ${label}`}
              data-testid={`${id}-add`}
              className="flex flex-col items-center justify-center gap-1 text-xs"
              style={{ width: tile.width, height: tile.height, border: '2px dashed var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
            >
              <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>+</span>
              Ajouter
            </button>
          </li>
        )}
      </ul>
      {error && <p className="text-xs mt-2" role="alert" style={{ color: '#D90000', fontFamily: 'var(--font-poppins)' }}>{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={addFiles} aria-label={`Choisir des images : ${label}`} className="sr-only" tabIndex={-1} data-testid={`${id}-input`} />
    </div>
  )
}
