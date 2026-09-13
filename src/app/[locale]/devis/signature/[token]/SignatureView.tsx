'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import FadeIn from '@/components/animations/FadeIn'
import SignaturePad from '@/components/admin/SignaturePad'
import { usePortfolio } from '@/providers/PortfolioContext'
import { getQuoteByToken, signQuote, declineQuote } from '@/actions/quotes'
import type { Quote } from '@/actions/quotes'

const QuoteView = dynamic(() => import('@/components/chat/QuoteView'), { ssr: false })

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

interface Props {
  token: string
}

type Phase = 'loading' | 'not-found' | 'review' | 'sign' | 'signed' | 'declined' | 'expired'

function isQuoteExpired(quote: Quote): boolean {
  const expiry = new Date(quote.dateEmission)
  expiry.setDate(expiry.getDate() + quote.validiteJours)
  return Date.now() > expiry.getTime()
}

export default function SignatureView({ token }: Props) {
  const { data } = usePortfolio()
  const { personal } = data

  const [phase, setPhase] = useState<Phase>('loading')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [showFullDocument, setShowFullDocument] = useState(false)

  const [accepted, setAccepted] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getQuoteByToken(token)
      .then((q) => {
        if (cancelled) return
        if (!q) { setPhase('not-found'); return }
        setQuote(q)
        setClientEmail(q.clientEmail ?? '')
        if (q.signature) setPhase('signed')
        else if (q.status === 'declined') setPhase('declined')
        else if (isQuoteExpired(q)) setPhase('expired')
        else setPhase('review')
      })
      .catch(() => { if (!cancelled) setPhase('not-found') })
    return () => { cancelled = true }
  }, [token])

  const handleDecline = async () => {
    if (declining || !confirm('Confirmez-vous le refus de ce devis ?')) return
    setDeclining(true)
    setError('')
    try {
      const result = await declineQuote(token)
      if (result.ok) { setQuote(result.quote); setPhase('declined') }
      else setError(result.error)
    } finally {
      setDeclining(false)
    }
  }

  const emailKnown = !!quote?.clientEmail
  const canSign = clientName.trim().length >= 2 && (emailKnown || /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(clientEmail)) && !!signatureDataUrl

  const handleSign = async () => {
    if (!canSign || submitting || !signatureDataUrl) return
    setSubmitting(true)
    setError('')
    try {
      const result = await signQuote(token, {
        clientName: clientName.trim(),
        clientEmail: emailKnown ? undefined : clientEmail.trim(),
        signatureDataUrl,
      })
      if (result.ok) { setQuote(result.quote); setPhase('signed') }
      else setError(result.error)
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  if (phase === 'not-found') {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="card p-8 text-center" style={{ maxWidth: 420 }}>
          <p className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>Lien invalide</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ce lien de signature est introuvable ou incorrect. Vérifiez qu&apos;il a été copié en entier.</p>
        </div>
      </div>
    )
  }

  if (!quote) return null

  const dateEmission = new Date(quote.dateEmission).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  const acompte = Math.round(quote.totalTTC * 0.3)
  const solde = quote.totalTTC - acompte

  return (
    <div className="relative min-h-dvh">
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <FadeIn>
          <div className="flex items-center gap-3 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset */}
            <img src="/logo-black.png" alt="" width={44} height={44} style={{ width: 44, height: 44 }} className="dark:invert" />
            <div>
              <p className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>{personal.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{personal.role}</p>
            </div>
          </div>
        </FadeIn>

        {(phase === 'signed' || phase === 'declined' || phase === 'expired') && (
          <FadeIn>
            <div className="card p-8 text-center mb-6">
              {phase === 'signed' && (
                <>
                  <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(0,128,0,0.1)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#008000" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <p className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>Devis signé — {quote.numero}</p>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                    Signé par {quote.signature?.name} le {quote.signature ? new Date(quote.signature.signedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </p>
                </>
              )}
              {phase === 'declined' && (
                <>
                  <p className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>Devis refusé — {quote.numero}</p>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Vous avez refusé ce devis. Contactez {personal.name} si vous souhaitez en discuter.</p>
                </>
              )}
              {phase === 'expired' && (
                <>
                  <p className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>Devis expiré — {quote.numero}</p>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>La validité de {quote.validiteJours} jours de ce devis est dépassée. Contactez {personal.name} pour une mise à jour.</p>
                </>
              )}
              <button onClick={() => setShowFullDocument(true)} className="btn-primary btn-sm">
                {phase === 'signed' ? 'Voir le contrat signé (PDF)' : 'Voir le devis (PDF)'}
              </button>
            </div>
          </FadeIn>
        )}

        {(phase === 'review' || phase === 'sign') && (
          <>
            <FadeIn>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                <div>
                  <p className="section-label mb-1">Devis n° {quote.numero}</p>
                  <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Signature du devis</h1>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 flex-shrink-0"
                  style={{ background: 'rgba(228,87,66,0.12)', color: '#E45742', border: '1px solid rgba(228,87,66,0.3)' }}
                >
                  En attente de signature
                </span>
              </div>
            </FadeIn>

            {/* Résumé */}
            <FadeIn delay={0.05}>
              <div className="card p-6 mb-5">
                <p className="section-label mb-3">Résumé du devis</p>
                <p className="text-sm mb-4" style={{ color: 'var(--text)', lineHeight: 1.6 }}>{quote.descriptionProjet}</p>

                <div className="space-y-1.5 mb-4">
                  {quote.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>{it.quantite} × {it.designation}</span>
                      <span style={{ color: 'var(--text)' }}>{fmt(it.quantite * it.prixUnitaireHT)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 mb-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="font-display font-semibold" style={{ color: 'var(--text)' }}>Total TTC</span>
                  <span className="font-display font-bold text-lg" style={{ color: 'var(--accent)' }}>{fmt(quote.totalTTC)}</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  <p><strong style={{ color: 'var(--text)' }}>Émis le :</strong> {dateEmission}</p>
                  <p><strong style={{ color: 'var(--text)' }}>Validité :</strong> {quote.validiteJours} jours</p>
                  <p><strong style={{ color: 'var(--text)' }}>Acompte (30 %) :</strong> {fmt(acompte)}</p>
                  <p><strong style={{ color: 'var(--text)' }}>Solde à la livraison :</strong> {fmt(solde)}</p>
                </div>

                <button onClick={() => setShowFullDocument(true)} className="btn-secondary btn-sm w-full justify-center">
                  Télécharger le devis complet (PDF)
                </button>
              </div>
            </FadeIn>

            {phase === 'review' && (
              <FadeIn delay={0.1}>
                <div className="card p-6 mb-5">
                  <label className="flex items-start gap-3 cursor-pointer mb-5">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="w-4 h-4 mt-0.5 cursor-pointer flex-shrink-0"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--text)' }}>
                      J&apos;ai pris connaissance du devis et j&apos;accepte les prestations, tarifs et conditions qui y sont indiqués.
                    </span>
                  </label>

                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={() => setPhase('sign')} disabled={!accepted} className="btn-primary btn-sm">
                      Continuer vers la signature
                    </button>
                    <button onClick={handleDecline} disabled={declining} className="text-sm font-medium" style={{ color: '#D90000' }}>
                      {declining ? 'Envoi…' : 'Refuser le devis'}
                    </button>
                  </div>
                </div>
              </FadeIn>
            )}

            {phase === 'sign' && (
              <FadeIn delay={0.1}>
                <div className="card p-6 mb-5">
                  <p className="section-label mb-4">Votre signature</p>

                  <SignaturePad onChange={setSignatureDataUrl} height={160} />

                  <div className="grid sm:grid-cols-2 gap-4 mt-5">
                    <div>
                      <label htmlFor="sig-name" className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Nom complet</label>
                      <input id="sig-name" className="input" autoComplete="name" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={100} placeholder="Prénom Nom" />
                    </div>
                    <div>
                      <label htmlFor="sig-email" className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>E-mail</label>
                      <input
                        id="sig-email" type="email" inputMode="email" autoComplete="email" className="input"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        disabled={emailKnown}
                        maxLength={254}
                        placeholder="vous@email.com"
                        style={emailKnown ? { opacity: 0.6 } : undefined}
                      />
                    </div>
                  </div>

                  <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                    <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Confirmer votre signature</p>
                    <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                      En validant, vous confirmez avoir pris connaissance du devis et accepter les conditions qui y sont indiquées.
                    </p>

                    {error && (
                      <p className="text-sm px-4 py-3 mb-4" style={{ background: 'rgba(217,0,0,0.1)', color: '#D90000', border: '1px solid rgba(217,0,0,0.25)' }}>{error}</p>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={handleSign} disabled={!canSign || submitting} className="btn-primary">
                        {submitting ? 'Signature en cours…' : 'Signer et accepter le devis'}
                      </button>
                      <button onClick={() => setPhase('review')} disabled={submitting} className="text-sm font-medium" style={{ color: 'var(--text-subtle)' }}>
                        Retour
                      </button>
                    </div>
                  </div>
                </div>
              </FadeIn>
            )}
          </>
        )}
      </div>

      {showFullDocument && (
        <QuoteView
          quote={quote}
          onClose={() => setShowFullDocument(false)}
          variant={quote.signature || quote.status === 'accepted' ? 'contrat' : 'devis'}
        />
      )}
    </div>
  )
}
