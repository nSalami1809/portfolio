'use client'

import { useRef, useState } from 'react'
import { compressImage, uploadFile, deleteUploadedFile } from '@/lib/upload'

interface Props {
  value?: string
  onChange: (url: string) => void
  label?: string
  size?: 'sm' | 'md' | 'lg'
  shape?: 'square' | 'circle'
  placeholder?: string
  maxSizeMb?: number
  maxSide?: number
}

const MAX_DEFAULT_MB = 8

export default function ImageUpload({
  value,
  onChange,
  label,
  size = 'md',
  shape = 'square',
  placeholder = 'Cliquer pour uploader',
  maxSizeMb = MAX_DEFAULT_MB,
  maxSide = 800,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dim = size === 'sm' ? 48 : size === 'md' ? 72 : 112
  const radius = shape === 'circle' ? '50%' : '0.75rem'

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      setError('Fichier invalide — image requise.')
      return
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${maxSizeMb} Mo).`)
      return
    }

    setLoading(true)
    try {
      const compressed = await compressImage(file, maxSide)
      const url = await uploadFile(compressed, file.name.replace(/\.[^.]+$/, '.jpg'))
      // Best-effort cleanup of the previous uploaded file
      if (value) deleteUploadedFile(value)
      onChange(url)
    } catch {
      setError('Erreur lors de l\'upload de l\'image.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = () => {
    if (value) deleteUploadedFile(value)
    onChange('')
    setError(null)
  }

  const buttonLabel = value ? 'Changer l\'image' : `Uploader ${label ?? 'une image'}`

  return (
    <div>
      {label && (
        <p className="field-label">{label}</p>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => !loading && inputRef.current?.click()}
          aria-label={buttonLabel}
          className="relative overflow-hidden transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          style={{
            width: dim,
            height: dim,
            borderRadius: radius,
            border: `2px ${value ? 'solid' : 'dashed'} ${error ? '#EF4444' : 'var(--border)'}`,
            background: value ? 'transparent' : 'var(--surface)',
            flexShrink: 0,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
            </div>
          ) : value ? (
            <>
              <img
                src={value}
                alt="preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.5)', borderRadius: radius }}
                aria-hidden="true"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-1.5 pointer-events-none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--text-muted)' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              {size !== 'sm' && (
                <span className="text-[10px] text-center leading-tight px-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  {placeholder}
                </span>
              )}
            </div>
          )}
        </button>

        <div className="flex flex-col gap-1.5">
          {value && !loading && (
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Supprimer l'image"
              className="btn-danger btn-xs"
            >
              Supprimer
            </button>
          )}
          {error && (
            <p className="text-xs" style={{ color: '#EF4444', fontFamily: 'var(--font-poppins)' }} role="alert">
              {error}
            </p>
          )}
          {!error && !value && size !== 'sm' && (
            <p className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
              JPG, PNG, WebP — max {maxSizeMb} Mo
            </p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          aria-label={buttonLabel}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
    </div>
  )
}
