'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { compressImage, uploadFile } from '@/lib/upload'
import { moveItem } from '@/lib/project-gallery'

const MAX_MB = 8
const MAX_SIDE = 1400

interface Props {
  /** Heading of the panel ("Version ordinateur"…); also names its controls for assistive technology. */
  label: string
  /** One sentence on what the visitor sees. */
  description: string
  /** What makes a good picture for this view. */
  tip: string
  /** Which device the panel is about: draws its icon and the shape of its tiles. */
  device: 'desktop' | 'phone'
  value: string[]
  onChange: (urls: string[]) => void
  /** How many pictures this panel may hold. */
  capacity: number
  /** The project's cover, shown first (read-only here: it is changed above) and counted in the limit. */
  leading?: string
  /** The total the visitor-facing limit is stated on. */
  limit: number
  /** Prefix of the data-testid attributes. */
  id?: string
}

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const MonitorIcon = ({ size = 20 }: { size?: number }) => <svg width={size} height={size} {...svg}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
const PhoneIcon = ({ size = 20 }: { size?: number }) => <svg width={size} height={size} {...svg}><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
const UploadIcon = () => <svg width={22} height={22} {...svg}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>

const mono = { fontFamily: 'var(--font-poppins)' } as const

// One view of a project (desktop or phone): its pictures as small devices, in the order the visitor
// sees them; add by clicking or by dropping files on the panel; move and remove. Same upload as the
// cover (compressed in the browser, then Vercel Blob), at a larger size so screenshots stay readable.
// Nothing is deleted from Blob here: like the cover, a change is only form state until the project is saved.
export default function GalleryEditor({ label, description, tip, device, value, onChange, capacity, leading, limit, id = 'gallery' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const phone = device === 'phone'
  const tileWidth = phone ? 76 : 132
  const total = value.length + (leading ? 1 : 0)
  const room = capacity - value.length - busy

  const addFiles = async (all: File[]) => {
    setError(null)
    if (!all.length) return
    const accepted = all.slice(0, Math.max(0, room))
    const problems: string[] = []
    if (all.length > accepted.length) problems.push(`Limite de ${limit} images : ${all.length - accepted.length} image(s) ignorée(s).`)

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

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    void addFiles(files)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (room > 0) void addFiles(Array.from(e.dataTransfer.files))
  }

  const buttonStyle = { width: 28, height: 28, padding: 0 } as const

  // The picture in a small browser window or a small phone.
  const device_ = (url: string, alt: string, badge: string) => (
    <div style={{ width: tileWidth, position: 'relative' }}>
      {phone ? (
        <div style={{ background: '#0f172a', padding: 3, borderRadius: 14 }}>
          <div className="relative" style={{ aspectRatio: '393/852', borderRadius: 11, overflow: 'hidden', background: 'var(--surface-hover)' }}>
            <Image src={url} alt={alt} fill sizes="76px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: 'var(--surface)' }}>
          <div aria-hidden="true" style={{ display: 'flex', gap: 3, padding: '4px 6px', background: 'var(--surface-hover)' }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border)' }} />)}
          </div>
          <div className="relative" style={{ aspectRatio: '16/10' }}>
            <Image src={url} alt={alt} fill sizes="132px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
          </div>
        </div>
      )}
      <span className="absolute text-[10px] font-bold px-1.5 py-0.5" style={{ top: phone ? 8 : 20, left: 6, background: 'var(--accent)', color: 'var(--accent-contrast)', ...mono }}>{badge}</span>
    </div>
  )

  const dropZone = value.length === 0 && !busy

  return (
    <div
      data-testid={`${id}-editor`}
      onDragOver={(e) => { if (room > 0) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }}
      onDrop={onDrop}
      style={{ border: `1px ${dragging ? 'dashed' : 'solid'} ${dragging ? 'var(--accent)' : 'var(--border)'}`, background: dragging ? 'var(--accent-glow)' : 'var(--surface)', padding: 16 }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <span style={{ color: 'var(--accent)', marginTop: 2 }}>{phone ? <PhoneIcon /> : <MonitorIcon />}</span>
          <div>
            <p className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>{label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', ...mono }}>{description}</p>
          </div>
        </div>
        <span data-testid={`${id}-count`} className="text-xs font-semibold shrink-0 px-2 py-1" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', ...mono }}>{total} / {limit}</span>
      </div>

      {dropZone ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={`Ajouter des images : ${label}`}
          data-testid={`${id}-add`}
          className="w-full flex flex-col items-center justify-center gap-2 py-7 text-center"
          style={{ border: '2px dashed var(--border)', background: 'var(--surface-hover)', color: 'var(--text-muted)', ...mono }}
        >
          <UploadIcon />
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Glissez vos captures ici ou cliquez pour parcourir</span>
          <span className="text-xs">JPG, PNG, WebP · {MAX_MB} Mo max · plusieurs fichiers à la fois</span>
        </button>
      ) : null}

      {(!dropZone || leading) && (
        <ul className="flex flex-wrap gap-4 list-none p-0 m-0">
          {leading && (
            <li data-testid={`${id}-cover`} style={{ width: tileWidth }}>
              {device_(leading, `${label} — couverture`, 'Couverture')}
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-subtle)', ...mono }}>Modifiable plus haut</p>
            </li>
          )}
          {value.map((url, i) => (
            <li key={url} data-testid={`${id}-item`} style={{ width: Math.max(tileWidth, 92) }}>
              {device_(url, `${label} — image ${i + 1 + (leading ? 1 : 0)}`, String(i + 1 + (leading ? 1 : 0)))}
              <div className="flex justify-between mt-1.5" style={{ width: Math.max(tileWidth, 92) }}>
                <span className="flex gap-1">
                  <button type="button" className="btn-secondary btn-xs inline-flex items-center justify-center" style={buttonStyle} disabled={i === 0} onClick={() => onChange(moveItem(value, i, i - 1))} aria-label={`Déplacer l'image ${i + 1} vers le début`} title="Vers le début" data-testid={`${id}-left`}>←</button>
                  <button type="button" className="btn-secondary btn-xs inline-flex items-center justify-center" style={buttonStyle} disabled={i === value.length - 1} onClick={() => onChange(moveItem(value, i, i + 1))} aria-label={`Déplacer l'image ${i + 1} vers la fin`} title="Vers la fin" data-testid={`${id}-right`}>→</button>
                </span>
                <button type="button" className="btn-danger btn-xs inline-flex items-center justify-center" style={buttonStyle} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Retirer l'image ${i + 1}`} title="Retirer" data-testid={`${id}-remove`}>✕</button>
              </div>
            </li>
          ))}
          {Array.from({ length: busy }, (_, i) => (
            <li key={`busy-${i}`} aria-busy="true" style={{ width: tileWidth }}>
              <div className="flex flex-col items-center justify-center gap-2" style={{ width: tileWidth, aspectRatio: phone ? '393/852' : '16/10', border: '2px dashed var(--border)', color: 'var(--text-subtle)' }}>
                <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                <span className="text-[10px]" style={mono}>Envoi…</span>
              </div>
            </li>
          ))}
          {room > 0 && !dropZone && (
            <li>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label={`Ajouter des images : ${label}`}
                data-testid={`${id}-add`}
                className="flex flex-col items-center justify-center gap-1 text-xs"
                style={{ width: tileWidth, aspectRatio: phone ? '393/852' : '16/10', border: '2px dashed var(--border)', background: 'var(--surface-hover)', color: 'var(--text-muted)', ...mono }}
              >
                <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                Ajouter
              </button>
            </li>
          )}
        </ul>
      )}

      <p className="text-xs mt-3" style={{ color: 'var(--text-subtle)', ...mono }}>{tip}</p>
      {error && <p className="text-xs mt-2" role="alert" style={{ color: '#D90000', ...mono }}>{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onInput} aria-label={`Choisir des images : ${label}`} className="sr-only" tabIndex={-1} data-testid={`${id}-input`} />
    </div>
  )
}
