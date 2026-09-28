'use client'

import { useRef, useState } from 'react'
import { useToast } from '@/components/admin/Toast'
import { saveBase64File } from '@/lib/browser-download'
import { previewSignaturePlaceholders, generateSignedDocx, type SignaturePlaceholder } from '@/actions/document-signature'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_MB = 15

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function AdminDocumentSignature() {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [filename, setFilename] = useState<string | null>(null)
  const [fileBase64, setFileBase64] = useState<string | null>(null)
  const [matches, setMatches] = useState<SignaturePlaceholder[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setFilename(null)
    setFileBase64(null)
    setMatches([])
    setSelected(new Set())
    setError(null)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    reset()

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError('Format non supporté — seuls les fichiers Word (.docx) sont acceptés.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${MAX_MB} Mo).`)
      return
    }

    setLoading(true)
    try {
      const base64 = await fileToBase64(file)
      const result = await previewSignaturePlaceholders(base64)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setFilename(file.name)
      setFileBase64(base64)
      setMatches(result.matches)
      setSelected(new Set(result.matches.map((m) => m.id)))
    } catch {
      setError("Erreur lors de la lecture du document.")
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleGenerate = async () => {
    if (!fileBase64 || !filename || !selected.size) return
    setGenerating(true)
    setError(null)
    try {
      const result = await generateSignedDocx(fileBase64, filename, [...selected])
      if (!result.ok) {
        setError(result.error)
        return
      }
      saveBase64File(result.fileBase64, result.filename, DOCX_MIME)
      toast('Document signé généré')
      reset()
    } catch {
      setError('Erreur lors de la génération du document.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Signature de documents</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
          Importez un document Word (.docx) — partout où le mot « signature » apparaît, votre signature enregistrée sera
          insérée juste après, accompagnée d&apos;un bloc de preuve électronique (nom, date, empreinte de vérification).
        </p>
      </div>

      {!filename && (
        <div className="card no-lift p-8 text-center">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="btn-primary btn-sm">
            {loading ? 'Analyse en cours…' : 'Choisir un document Word (.docx)'}
          </button>
          <p className="text-xs mt-3" style={{ color: 'var(--text-subtle)' }}>
            .docx uniquement — max {MAX_MB} Mo. Seul le corps du document est analysé (pas les en-têtes/pieds de page).
          </p>
          <input ref={fileInputRef} type="file" accept=".docx" onChange={handleFile} className="sr-only" tabIndex={-1} aria-label="Importer un document Word" />
        </div>
      )}

      {filename && matches.length > 0 && (
        <div className="card no-lift p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-medium">{filename}</p>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {matches.length} occurrence{matches.length > 1 ? 's' : ''} du mot « signature » trouvée{matches.length > 1 ? 's' : ''} — cochez celles à signer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileBase64 && saveBase64File(fileBase64, filename, DOCX_MIME)}
                className="btn-secondary btn-xs"
              >
                Télécharger le document original
              </button>
              <button type="button" onClick={reset} className="btn-secondary btn-xs">Changer de document</button>
            </div>
          </div>

          <ul className="space-y-2">
            {matches.map((m, i) => (
              <li key={m.id} className="flex items-start gap-3 p-3" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                  className="mt-1"
                  aria-label={`Signer l'emplacement ${i + 1}`}
                />
                <span className="text-sm" style={{ fontFamily: 'var(--font-poppins)' }}>{m.snippet}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleGenerate} disabled={!selected.size || generating} className="btn-primary btn-sm">
              {generating ? 'Génération…' : `Générer le document signé (${selected.size})`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: '#D90000' }} role="alert">{error}</p>}
    </div>
  )
}
