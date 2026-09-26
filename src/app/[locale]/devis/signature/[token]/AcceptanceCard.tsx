'use client'

import { useState } from 'react'
import FadeIn from '@/components/animations/FadeIn'
import SignaturePad from '@/components/admin/SignaturePad'
import { downloadQuotePdf, type Quote } from '@/actions/quotes'
import { signAcceptance } from '@/actions/lifecycle'
import { RECETTE_DAYS, addBusinessDays, formatLongDate } from '@/lib/quote-document'
import { saveBase64Pdf } from '@/lib/browser-download'

interface Props {
  token: string
  quote: Quote
  onSigned: (quote: Quote) => void
}

// The recette step: once the provider has delivered the project, the client
// signs a procès-verbal (with or without reserves) from the same private link
// they signed the devis with.
export default function AcceptanceCard({ token, quote, onSigned }: Props) {
  const delivery = quote.delivery
  const [withReserves, setWithReserves] = useState(false)
  const [reserves, setReserves] = useState('')
  const [name, setName] = useState(quote.signature?.name ?? '')
  const [signature, setSignature] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  if (!delivery) return null

  const canSubmit = name.trim().length >= 2 && !!signature && (!withReserves || reserves.trim().length >= 5)

  const handleDownload = async () => {
    setDownloading(true)
    setError('')
    try {
      const result = await downloadQuotePdf(quote.accessCode, 'pv')
      if (result.ok) saveBase64Pdf(result.base64, result.filename)
      else setError(result.error)
    } catch {
      setError('Une erreur est survenue. Réessayez plus tard.')
    } finally {
      setDownloading(false)
    }
  }

  const handleSign = async () => {
    if (!canSubmit || submitting || !signature) return
    setSubmitting(true)
    setError('')
    try {
      const result = await signAcceptance(token, {
        clientName: name.trim(),
        signatureDataUrl: signature,
        reserves: withReserves ? reserves.trim() : '',
      })
      if (result.ok) onSigned(result.quote)
      else setError(result.error)
    } finally {
      setSubmitting(false)
    }
  }

  if (quote.acceptance) {
    return (
      <FadeIn delay={0.05}>
        <div className="card p-6 mb-6">
          <p className="section-label mb-2">Procès-verbal de recette</p>
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>
            {quote.acceptance.reserves ? 'Recette signée avec réserves' : 'Recette signée sans réserve'}
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Signée par {quote.acceptance.name} le {formatLongDate(quote.acceptance.signedAt)}.
          </p>
          {error && <p className="text-sm mb-3" style={{ color: '#D90000' }}>{error}</p>}
          <button onClick={handleDownload} disabled={downloading} className="btn-secondary btn-sm">
            {downloading ? 'Génération…' : 'Télécharger le procès-verbal (PDF)'}
          </button>
        </div>
      </FadeIn>
    )
  }

  const deemedBy = formatLongDate(addBusinessDays(delivery.deliveredAt, RECETTE_DAYS))

  return (
    <FadeIn delay={0.05}>
      <div className="card p-6 mb-6">
        <p className="section-label mb-2">Procès-verbal de recette</p>
        <p className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--text)' }}>Votre projet est livré</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Livré le {formatLongDate(delivery.deliveredAt)}. Vérifiez les prestations puis signez le procès-verbal, avec ou sans réserves.
          Sans retour de votre part d&apos;ici le {deemedBy} ({RECETTE_DAYS} jours ouvrés), la livraison est réputée acceptée.
        </p>
        {delivery.liveUrl && (
          <p className="text-sm mb-2" style={{ color: 'var(--text)' }}>
            <strong>Accès :</strong>{' '}
            <a href={delivery.liveUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{delivery.liveUrl}</a>
          </p>
        )}
        {delivery.note && <p className="text-sm mb-4" style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{delivery.note}</p>}

        <button onClick={handleDownload} disabled={downloading} className="btn-secondary btn-sm mb-5">
          {downloading ? 'Génération…' : 'Télécharger le procès-verbal (PDF)'}
        </button>

        <fieldset className="mb-4" style={{ border: 'none', padding: 0 }}>
          <legend className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Ma décision</legend>
          <label className="flex items-center gap-2 text-sm cursor-pointer mb-1.5" style={{ color: 'var(--text)' }}>
            <input type="radio" name="recette" checked={!withReserves} onChange={() => setWithReserves(false)} style={{ accentColor: 'var(--accent)' }} />
            Je prononce la recette sans réserve
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
            <input type="radio" name="recette" checked={withReserves} onChange={() => setWithReserves(true)} style={{ accentColor: 'var(--accent)' }} />
            Je prononce la recette avec réserves
          </label>
        </fieldset>

        {withReserves && (
          <div className="mb-4">
            <label htmlFor="pv-reserves" className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Décrivez précisément vos réserves</label>
            <textarea id="pv-reserves" className="input" rows={4} maxLength={1000} value={reserves} onChange={(e) => setReserves(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        )}

        <SignaturePad onChange={setSignature} height={140} />
        <div className="mt-4">
          <label htmlFor="pv-name" className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Nom complet</label>
          <input id="pv-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Prénom Nom" />
        </div>

        {error && (
          <p className="text-sm px-4 py-3 mt-4" style={{ background: 'rgba(217,0,0,0.1)', color: '#D90000', border: '1px solid rgba(217,0,0,0.25)' }}>{error}</p>
        )}
        <button onClick={handleSign} disabled={!canSubmit || submitting} className="btn-primary mt-5">
          {submitting ? 'Signature en cours…' : 'Signer le procès-verbal'}
        </button>
      </div>
    </FadeIn>
  )
}
