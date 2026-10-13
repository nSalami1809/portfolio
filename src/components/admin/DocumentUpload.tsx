'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { uploadFile, uploadDocumentFile, deleteUploadedFile, type UploadedDocument } from '@/lib/upload'
import { renderPdfThumbnail } from '@/lib/pdf-thumbnail'

interface Value {
  fileUrl: string
  fileName: string
  fileType: 'pdf' | 'docx' | 'doc'
  fileSize: number
  thumbnailUrl?: string
}

interface Props {
  value: Value
  onChange: (value: Value) => void
  maxSizeMb?: number
}

const MAX_DEFAULT_MB = 15

const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 Ko'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`
}

export default function DocumentUpload({ value, onChange, maxSizeMb = MAX_DEFAULT_MB }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const isPdf = file.type === 'application/pdf'
    const isDoc = file.type === 'application/msword'
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (!isPdf && !isDoc && !isDocx) {
      setError('Fichier invalide — PDF, DOC ou DOCX requis.')
      return
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${maxSizeMb} Mo).`)
      return
    }

    setLoading(true)
    try {
      const uploaded: UploadedDocument = await uploadDocumentFile(file)

      // Best-effort — a PDF's first page becomes the list card's thumbnail.
      // Generation or upload failing here must never block the document
      // itself from being saved; it just falls back to the generic icon.
      let thumbnailUrl: string | undefined
      if (isPdf) {
        const thumb = await renderPdfThumbnail(file).catch(() => null)
        if (thumb) thumbnailUrl = await uploadFile(thumb, 'thumbnail.png').catch(() => undefined)
      }

      const previousUrl = value.fileUrl
      const previousThumbnailUrl = value.thumbnailUrl
      onChange({ fileUrl: uploaded.url, fileName: uploaded.name, fileType: uploaded.fileType, fileSize: uploaded.size, thumbnailUrl })
      // Only now that the new file (and thumbnail) are confirmed uploaded is
      // it safe to drop the old blobs — same ordering as everywhere else
      // this pattern is used.
      if (previousUrl) deleteUploadedFile(previousUrl)
      if (previousThumbnailUrl) deleteUploadedFile(previousThumbnailUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload du document.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = () => {
    if (value.fileUrl) deleteUploadedFile(value.fileUrl)
    if (value.thumbnailUrl) deleteUploadedFile(value.thumbnailUrl)
    onChange({ fileUrl: '', fileName: '', fileType: 'pdf', fileSize: 0, thumbnailUrl: undefined })
    setError(null)
  }

  return (
    <div>
      {value.thumbnailUrl && !loading && (
        <div
          className="relative w-24 h-32 rounded-lg overflow-hidden mb-3"
          style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
        >
          <Image src={value.thumbnailUrl} alt="" fill sizes="96px" unoptimized className="object-cover" />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => !loading && inputRef.current?.click()}
          disabled={loading}
          className="btn-secondary btn-sm"
        >
          {loading ? 'Envoi en cours…' : value.fileUrl ? 'Remplacer le fichier' : 'Choisir un fichier'}
        </button>

        {value.fileUrl && !loading && (
          <button type="button" onClick={handleRemove} className="btn-danger btn-xs">
            Supprimer
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          aria-label="Choisir un document"
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {value.fileUrl && !loading && (
        <p className="text-xs mt-2 truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {value.fileName} · {value.fileType.toUpperCase()} · {formatSize(value.fileSize)}
        </p>
      )}

      {error && (
        <p className="text-xs mt-2" style={{ color: '#D90000', fontFamily: 'var(--font-poppins)' }} role="alert">
          {error}
        </p>
      )}

      {!error && !value.fileUrl && !loading && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          PDF, DOC, DOCX — max {maxSizeMb} Mo
        </p>
      )}
    </div>
  )
}
