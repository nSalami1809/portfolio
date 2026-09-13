'use client'

import { useRef, useState } from 'react'
import SignaturePad from './SignaturePad'
import { uploadFile, deleteUploadedFile } from '@/lib/upload'

interface Props {
  value?: string
  onChange: (url: string) => void
}

const MAX_MB = 2
const ACCEPTED = ['image/png', 'image/jpeg']

// Uploaded verbatim — unlike ImageUpload's photo pipeline, a signature must
// never be re-encoded to JPEG: that would silently kill the transparent
// background a drawn or imported PNG relies on.
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? 'image/png'
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

type Mode = 'preview' | 'choosing' | 'draw'

export default function SignatureSettings({ value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>(value ? 'preview' : 'choosing')
  const [drawnDataUrl, setDrawnDataUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSaveDrawn = async () => {
    if (!drawnDataUrl) return
    setUploading(true)
    setError(null)
    try {
      const blob = dataUrlToBlob(drawnDataUrl)
      const url = await uploadFile(blob, 'signature.png')
      onChange(url)
      setDrawnDataUrl(null)
      setMode('preview')
    } catch {
      setError("Erreur lors de l'enregistrement de la signature.")
    } finally {
      setUploading(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!ACCEPTED.includes(file.type)) {
      setError('Format non supporté — PNG ou JPG uniquement.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${MAX_MB} Mo).`)
      return
    }

    setUploading(true)
    try {
      const url = await uploadFile(file, file.name)
      onChange(url)
      setMode('preview')
    } catch {
      setError("Erreur lors de l'upload de la signature.")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = () => {
    if (value) deleteUploadedFile(value)
    onChange('')
    setMode('choosing')
  }

  return (
    <div>
      {mode === 'preview' && value && (
        <div className="flex items-center gap-4 flex-wrap">
          <div style={{ background: '#ffffff', border: '1px solid var(--border)', padding: '0.75rem 1.25rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- external blob URL, arbitrary aspect ratio */}
            <img src={value} alt="Signature actuelle" style={{ height: 60, display: 'block' }} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMode('choosing')} className="btn-secondary btn-xs">Modifier</button>
            <button type="button" onClick={handleDelete} className="btn-danger btn-xs">Supprimer</button>
          </div>
        </div>
      )}

      {mode === 'choosing' && (
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setMode('draw')} className="btn-secondary btn-sm">Dessiner ma signature</button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary btn-sm">
            {uploading ? 'Envoi…' : 'Importer une signature'}
          </button>
          {value && (
            <button type="button" onClick={() => setMode('preview')} className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>
              Annuler
            </button>
          )}
        </div>
      )}

      {mode === 'draw' && (
        <div className="space-y-3">
          <SignaturePad onChange={setDrawnDataUrl} height={160} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSaveDrawn} disabled={!drawnDataUrl || uploading} className="btn-primary btn-sm">
              {uploading ? 'Enregistrement…' : 'Valider la signature'}
            </button>
            <button type="button" onClick={() => { setMode(value ? 'preview' : 'choosing'); setDrawnDataUrl(null) }} className="btn-secondary btn-sm">
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs mt-2" style={{ color: '#D90000' }} role="alert">{error}</p>}
      {!error && mode !== 'draw' && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          PNG (transparence) ou JPG — max {MAX_MB} Mo. Apparaît sur les devis et contrats signés électroniquement.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleImportFile}
        className="sr-only"
        tabIndex={-1}
        aria-label="Importer une signature"
      />
    </div>
  )
}
