'use client'

import { useRef, useState } from 'react'
import { uploadFile, deleteUploadedFile } from '@/lib/upload'

interface Props {
  value?: string
  onChange: (url: string) => void
  accept: string
  maxSizeMb?: number
  hint?: string
}

function fileNameFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').pop() ?? ''
    // Stored as `${Date.now()}-${originalName}` plus a random suffix — strip the timestamp prefix for display
    return decodeURIComponent(last.replace(/^\d+-/, ''))
  } catch {
    return url
  }
}

export default function FileUpload({ value, onChange, accept, maxSizeMb = 5, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${maxSizeMb} Mo).`)
      return
    }

    setLoading(true)
    try {
      const url = await uploadFile(file, file.name)
      if (value) deleteUploadedFile(value)
      onChange(url)
    } catch {
      setError("Erreur lors de l'upload du fichier.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = () => {
    if (value) deleteUploadedFile(value)
    onChange('')
    setError(null)
  }

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--surface-hover)]"
            style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
            </svg>
            <span className="truncate max-w-[220px]">{fileNameFromUrl(value)}</span>
          </a>
          <button
            type="button"
            onClick={() => !loading && inputRef.current?.click()}
            disabled={loading}
            className="btn-secondary btn-xs"
          >
            {loading ? 'Envoi…' : 'Remplacer'}
          </button>
          <button type="button" onClick={handleRemove} disabled={loading} className="btn-danger btn-xs">
            Supprimer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !loading && inputRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--surface-hover)]"
          style={{ border: `1.5px dashed ${error ? '#EF4444' : 'var(--border)'}`, color: 'var(--text-muted)', cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
          )}
          {loading ? 'Envoi…' : 'Uploader un fichier'}
        </button>
      )}

      {error && (
        <p className="text-xs mt-2" style={{ color: '#EF4444', fontFamily: 'var(--font-poppins)' }} role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          {hint}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        aria-label="Uploader un fichier"
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  )
}
