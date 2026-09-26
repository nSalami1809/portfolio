'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import FadeIn from '@/components/animations/FadeIn'
import SignaturePad from '@/components/admin/SignaturePad'
import { usePortfolio } from '@/providers/portfolio-core'
import { getQuoteByToken, signQuote, declineQuote, requestSignatureCode } from '@/actions/quotes'
import type { Quote } from '@/actions/quotes'
import { useLocale } from '@/lib/i18n/useLocale'
import { resolveTerms, splitPayment, wantsSignatureOtp } from '@/lib/business'
import { fmt as fmtMoney } from '@/lib/doc-common'

const QuoteView = dynamic(() => import('@/components/chat/QuoteView'), { ssr: false })

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
  const locale = useLocale()
  const en = locale === 'en'
  const T = (fr: string, english: string) => (en ? english : fr)
  const fmt = (n: number) => fmtMoney(n, en ? 'en' : 'fr')
  const dateLocale = en ? 'en-GB' : 'fr-FR'

  const [phase, setPhase] = useState<Phase>('loading')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [showFullDocument, setShowFullDocument] = useState(false)

  const [accepted, setAccepted] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [sendingCode, setSendingCode] = useState(false)

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
    if (declining || !confirm(T('Confirmez-vous le refus de ce devis ?', 'Do you confirm declining this quote?'))) return
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
  const emailValid = emailKnown || /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(clientEmail)
  const needsCode = quote ? wantsSignatureOtp(resolveTerms(quote, personal)) : false
  const canSign = clientName.trim().length >= 2 && emailValid && !!signatureDataUrl && (!needsCode || /^\d{6}$/.test(code))

  const handleSendCode = async () => {
    if (!emailValid || sendingCode) return
    setSendingCode(true)
    setError('')
    try {
      const result = await requestSignatureCode(token, emailKnown ? undefined : clientEmail.trim())
      if (result.ok) setCodeSentTo(result.sentTo)
      else setError(result.error)
    } catch {
      setError(T("Impossible d'envoyer le code. Réessayez.", 'Could not send the code. Please try again.'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleSign = async () => {
    if (!canSign || submitting || !signatureDataUrl) return
    setSubmitting(true)
    setError('')
    try {
      const result = await signQuote(token, {
        clientName: clientName.trim(),
        clientEmail: emailKnown ? undefined : clientEmail.trim(),
        signatureDataUrl,
        acceptedTerms: accepted,
        otp: needsCode ? code : undefined,
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
          <p className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>{T('Lien invalide', 'Invalid link')}</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{T("Ce lien de signature est introuvable ou incorrect. Vérifiez qu'il a été copié en entier.", 'This signing link is missing or incorrect. Check that it was copied in full.')}</p>
        </div>
      </div>
    )
  }

  if (!quote) return null

  const dateEmission = new Date(quote.dateEmission).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' })
  const terms = resolveTerms(quote, personal)
  const hasDeposit = terms.depositPercent > 0 && terms.depositPercent < 100
  const { acompte, solde } = splitPayment(quote.totalTTC, terms.depositPercent)
  const isAvenant = quote.kind === 'avenant'
  const noun = isAvenant ? T('avenant', 'amendment') : T('devis', 'quote')
  const Noun = isAvenant ? T('Avenant', 'Amendment') : T('Devis', 'Quote')

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
                  <p className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>{Noun} {T('signé', 'signed')} — {quote.numero}</p>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                    {T('Signé par', 'Signed by')} {quote.signature?.name} {T('le', 'on')} {quote.signature ? new Date(quote.signature.signedAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </p>
                </>
              )}
              {phase === 'declined' && (
                <>
                  <p className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>{Noun} {T('refusé', 'declined')} — {quote.numero}</p>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>{en ? `You declined this ${noun}. Contact ${personal.name} if you would like to discuss it.` : `Vous avez refusé cet ${noun}. Contactez ${personal.name} si vous souhaitez en discuter.`}</p>
                </>
              )}
              {phase === 'expired' && (
                <>
                  <p className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>{Noun} {T('expiré', 'expired')} — {quote.numero}</p>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>{en ? `The ${quote.validiteJours}-day validity of this ${noun} has passed. Contact ${personal.name} for an update.` : `La validité de ${quote.validiteJours} jours de cet ${noun} est dépassée. Contactez ${personal.name} pour une mise à jour.`}</p>
                </>
              )}
              <button onClick={() => setShowFullDocument(true)} className="btn-primary btn-sm">
                {phase === 'signed' ? (en ? `View the signed ${isAvenant ? 'amendment' : 'contract'} (PDF)` : `Voir le ${isAvenant ? 'avenant' : 'contrat'} signé (PDF)`) : (en ? `View the ${noun} (PDF)` : `Voir le ${noun} (PDF)`)}
              </button>
            </div>
          </FadeIn>
        )}


        {(phase === 'review' || phase === 'sign') && (
          <>
            <FadeIn>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                <div>
                  <p className="section-label mb-1">{Noun} {T('n°', 'no.')} {quote.numero}</p>
                  <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>{en ? `Signing the ${noun}` : `Signature ${isAvenant ? "de l'avenant" : 'du devis'}`}</h1>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 flex-shrink-0"
                  style={{ background: 'rgba(228,87,66,0.12)', color: '#E45742', border: '1px solid rgba(228,87,66,0.3)' }}
                >
                  {T('En attente de signature', 'Awaiting signature')}
                </span>
              </div>
            </FadeIn>

            {/* Résumé */}
            <FadeIn delay={0.05}>
              <div className="card p-6 mb-5">
                <p className="section-label mb-3">{T('Résumé du devis', 'Quote summary')}</p>
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
                  <span className="font-display font-semibold" style={{ color: 'var(--text)' }}>{T('Total TTC', 'Total incl. tax')}</span>
                  <span className="font-display font-bold text-lg" style={{ color: 'var(--accent)' }}>{fmt(quote.totalTTC)}</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  <p><strong style={{ color: 'var(--text)' }}>{T('Émis le :', 'Issued:')}</strong> {dateEmission}</p>
                  <p><strong style={{ color: 'var(--text)' }}>{T('Validité :', 'Valid for:')}</strong> {quote.validiteJours} {T('jours', 'days')}</p>
                  {hasDeposit ? (
                    <>
                      <p><strong style={{ color: 'var(--text)' }}>{T('Acompte', 'Deposit')} ({terms.depositPercent}{en ? '%' : ' %'}) :</strong> {fmt(acompte)}</p>
                      <p><strong style={{ color: 'var(--text)' }}>{T('Solde à la livraison :', 'Balance on delivery:')}</strong> {fmt(solde)}</p>
                    </>
                  ) : (
                    <p><strong style={{ color: 'var(--text)' }}>{T('Paiement :', 'Payment:')}</strong> {fmt(quote.totalTTC)} {T('à la livraison', 'on delivery')}</p>
                  )}
                  <p><strong style={{ color: 'var(--text)' }}>{T('Délai :', 'Lead time:')}</strong> {terms.deliveryDays} {T('jours ouvrés', 'working days')}{quote.extraDelayDays ? (en ? ` (+ ${quote.extraDelayDays} for this amendment)` : ` (+ ${quote.extraDelayDays} pour cet avenant)`) : ''}</p>
                  <p><strong style={{ color: 'var(--text)' }}>{T('Révisions incluses :', 'Included revisions:')}</strong> {terms.includedRevisions}</p>
                </div>

                <button onClick={() => setShowFullDocument(true)} className="btn-secondary btn-sm w-full justify-center">
                  {T('Télécharger le devis complet (PDF)', 'Download the full quote (PDF)')}
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
                    <span className="text-sm" style={{ color: 'var(--text)', lineHeight: 1.6 }}>
                      {en ? <>I have read the {noun} and the{' '}</> : <>J&apos;ai pris connaissance du {noun} et des{' '}</>}
                      <a href={`/${locale}/cgv`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{T('Conditions Générales de Vente', 'General Terms of Sale')}</a>,
                      {' '}{T("j'accepte les prestations, tarifs et conditions qui y sont indiqués, et je déclare avoir la capacité de m'engager (et, si j'agis pour une société, le pouvoir de l'engager).", 'I accept the services, prices and conditions stated in them, and I declare that I have the capacity to bind myself (and, if I act for a company, the authority to bind it).')}
                    </span>
                  </label>

                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={() => setPhase('sign')} disabled={!accepted} className="btn-primary btn-sm">
                      {T('Continuer vers la signature', 'Continue to signing')}
                    </button>
                    <button onClick={handleDecline} disabled={declining} className="text-sm font-medium" style={{ color: '#D90000' }}>
                      {declining ? T('Envoi…', 'Sending…') : en ? `Decline the ${noun}` : `Refuser l${isAvenant ? "'avenant" : 'e devis'}`}
                    </button>
                  </div>
                </div>
              </FadeIn>
            )}

            {phase === 'sign' && (
              <FadeIn delay={0.1}>
                <div className="card p-6 mb-5">
                  <p className="section-label mb-4">{T('Votre signature', 'Your signature')}</p>

                  <SignaturePad onChange={setSignatureDataUrl} height={160} />

                  <div className="grid sm:grid-cols-2 gap-4 mt-5">
                    <div>
                      <label htmlFor="sig-name" className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{T('Nom complet', 'Full name')}</label>
                      <input id="sig-name" className="input" autoComplete="name" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={100} placeholder={T('Prénom Nom', 'First and last name')} />
                    </div>
                    <div>
                      <label htmlFor="sig-email" className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{T('E-mail', 'Email')}</label>
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

                  {needsCode && (
                    <div className="mt-5 p-4" style={{ background: 'var(--bg-subtle, rgba(127,127,127,0.06))', border: '1px solid var(--border)' }}>
                      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>{T('Code de confirmation', 'Confirmation code')}</p>
                      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                        {T("Pour confirmer que vous êtes bien à l'origine de cette signature, nous vous envoyons un code à 6 chiffres par email.", 'To confirm that you are the one signing, we email you a 6-digit code.')}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <button type="button" onClick={handleSendCode} disabled={!emailValid || sendingCode} className="btn-secondary btn-sm">
                          {sendingCode ? T('Envoi…', 'Sending…') : codeSentTo ? T('Renvoyer le code', 'Resend the code') : T('Recevoir le code par email', 'Email me the code')}
                        </button>
                        {codeSentTo && (
                          <input
                            id="sig-code" inputMode="numeric" autoComplete="one-time-code" aria-label={T('Code à 6 chiffres', '6-digit code')} className="input"
                            style={{ width: 150, letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'monospace' }}
                            value={code} maxLength={6} placeholder="••••••"
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          />
                        )}
                      </div>
                      {codeSentTo && <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>{T('Code envoyé à', 'Code sent to')} {codeSentTo} — {T('valable 10 minutes. Pensez à vérifier vos courriers indésirables.', 'valid for 10 minutes. Remember to check your spam folder.')}</p>}
                    </div>
                  )}

                  <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                    <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{T('Confirmer votre signature', 'Confirm your signature')}</p>
                    <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                      {T('En validant, vous confirmez avoir pris connaissance du devis et accepter les conditions qui y sont indiquées.', 'By confirming, you acknowledge having read the quote and accept the conditions it states.')}
                    </p>

                    {error && (
                      <p className="text-sm px-4 py-3 mb-4" style={{ background: 'rgba(217,0,0,0.1)', color: '#D90000', border: '1px solid rgba(217,0,0,0.25)' }}>{error}</p>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={handleSign} disabled={!canSign || submitting} className="btn-primary">
                        {submitting ? T('Signature en cours…', 'Signing…') : en ? `Sign and accept the ${noun}` : `Signer et accepter l${isAvenant ? "'avenant" : 'e devis'}`}
                      </button>
                      <button onClick={() => setPhase('review')} disabled={submitting} className="text-sm font-medium" style={{ color: 'var(--text-subtle)' }}>
                        {T('Retour', 'Back')}
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
