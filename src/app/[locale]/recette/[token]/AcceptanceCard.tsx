'use client'

import { useState } from 'react'
import FadeIn from '@/components/animations/FadeIn'
import SignaturePad from '@/components/admin/SignaturePad'
import { downloadQuotePdf, type Quote } from '@/actions/quotes'
import { signAcceptance } from '@/actions/lifecycle'
import { RECETTE_DAYS, addBusinessDays, formatLongDate } from '@/lib/quote-document'
import { useLocale } from '@/lib/i18n/useLocale'
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
  const en = useLocale() === 'en'
  const T = (fr: string, english: string) => (en ? english : fr)
  const day = (d: string) => formatLongDate(d, en ? 'en' : 'fr')
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
      setError(T('Une erreur est survenue. Réessayez plus tard.', 'Something went wrong. Please try again later.'))
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
          <p className="section-label mb-2">{T('Procès-verbal de recette', 'Acceptance report')}</p>
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>
            {quote.acceptance.reserves ? T('Recette signée avec réserves', 'Acceptance signed with reservations') : T('Recette signée sans réserve', 'Acceptance signed without reservation')}
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            {T('Signée par', 'Signed by')} {quote.acceptance.name} {T('le', 'on')} {day(quote.acceptance.signedAt)}.
          </p>
          {error && <p className="text-sm mb-3" style={{ color: '#D90000' }}>{error}</p>}
          <button onClick={handleDownload} disabled={downloading} className="btn-secondary btn-sm">
            {downloading ? T('Génération…', 'Generating…') : T('Télécharger le procès-verbal (PDF)', 'Download the acceptance report (PDF)')}
          </button>
        </div>
      </FadeIn>
    )
  }

  const deemedBy = day(addBusinessDays(delivery.deliveredAt, RECETTE_DAYS).toISOString())

  return (
    <FadeIn delay={0.05}>
      <div className="card p-6 mb-6">
        <p className="section-label mb-2">{T('Procès-verbal de recette', 'Acceptance report')}</p>
        <p className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--text)' }}>{T('Votre projet est livré', 'Your project is delivered')}</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {en
            ? `Delivered on ${day(delivery.deliveredAt)}. Check the services, then sign the report, with or without reservations. With no answer from you by ${deemedBy} (${RECETTE_DAYS} working days), delivery is deemed accepted.`
            : `Livré le ${day(delivery.deliveredAt)}. Vérifiez les prestations puis signez le procès-verbal, avec ou sans réserves. Sans retour de votre part d'ici le ${deemedBy} (${RECETTE_DAYS} jours ouvrés), la livraison est réputée acceptée.`}
        </p>
        {delivery.liveUrl && (
          <p className="text-sm mb-2" style={{ color: 'var(--text)' }}>
            <strong>{T('Accès :', 'Access:')}</strong>{' '}
            <a href={delivery.liveUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{delivery.liveUrl}</a>
          </p>
        )}
        {delivery.note && <p className="text-sm mb-4" style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{delivery.note}</p>}

        <button onClick={handleDownload} disabled={downloading} className="btn-secondary btn-sm mb-5">
          {downloading ? T('Génération…', 'Generating…') : T('Télécharger le procès-verbal (PDF)', 'Download the acceptance report (PDF)')}
        </button>

        <fieldset className="mb-4" style={{ border: 'none', padding: 0 }}>
          <legend className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{T('Ma décision', 'My decision')}</legend>
          <label className="flex items-center gap-2 text-sm cursor-pointer mb-1.5" style={{ color: 'var(--text)' }}>
            <input type="radio" name="recette" checked={!withReserves} onChange={() => setWithReserves(false)} style={{ accentColor: 'var(--accent)' }} />
            {T('Je prononce la recette sans réserve', 'I grant acceptance without reservation')}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
            <input type="radio" name="recette" checked={withReserves} onChange={() => setWithReserves(true)} style={{ accentColor: 'var(--accent)' }} />
            {T('Je prononce la recette avec réserves', 'I grant acceptance with reservations')}
          </label>
        </fieldset>

        {withReserves && (
          <div className="mb-4">
            <label htmlFor="pv-reserves" className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{T('Décrivez précisément vos réserves', 'Describe your reservations precisely')}</label>
            <textarea id="pv-reserves" className="input" rows={4} maxLength={1000} value={reserves} onChange={(e) => setReserves(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        )}

        <SignaturePad onChange={setSignature} height={140} />
        <div className="mt-4">
          <label htmlFor="pv-name" className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{T('Nom complet', 'Full name')}</label>
          <input id="pv-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={T('Prénom Nom', 'First and last name')} />
        </div>

        {error && (
          <p className="text-sm px-4 py-3 mt-4" style={{ background: 'rgba(217,0,0,0.1)', color: '#D90000', border: '1px solid rgba(217,0,0,0.25)' }}>{error}</p>
        )}
        <button onClick={handleSign} disabled={!canSubmit || submitting} className="btn-primary mt-5">
          {submitting ? T('Signature en cours…', 'Signing…') : T('Signer le procès-verbal', 'Sign the acceptance report')}
        </button>
      </div>
    </FadeIn>
  )
}
