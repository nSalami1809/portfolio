'use client'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import FadeIn from '@/components/animations/FadeIn'
import { usePortfolio } from '@/providers/PortfolioContext'
import { submitQuote, lookupQuote } from '@/actions/quotes'
import type { Quote } from '@/actions/quotes'
import type { Dictionary } from '@/lib/i18n/dictionaries'

// QuoteView (qrcode dependency) is only needed once a quote actually exists
// — lazy-loaded so it never adds weight to visitors filling the form.
const QuoteView = dynamic(() => import('@/components/chat/QuoteView'), { ssr: false })

interface Props {
  t: Dictionary['devis']
}

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
const fieldLabel = 'block text-xs font-medium mb-2'
const labelStyle = { color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' } as const

const EMPTY_FORM = { clientNom: '', clientSociete: '', clientAdresse: '', clientEmail: '', clientTelephone: '', descriptionProjet: '' }

export default function DevisView({ t }: Props) {
  const { data } = usePortfolio()
  // Only offers the admin has given a real numeric price can be picked here
  // — offers priced "sur devis" (priceLabel only) stay chat/contact-only.
  const priceableOffers = useMemo(
    () => data.offers.filter((o) => typeof o.priceHT === 'number' && o.priceHT > 0),
    [data.offers],
  )

  const [form, setForm] = useState(EMPTY_FORM)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [createdQuote, setCreatedQuote] = useState<Quote | null>(null)

  const setQty = (id: string, qty: number) => setQuantities((p) => ({ ...p, [id]: Math.max(0, Math.min(99, qty)) }))

  const selectedItems = useMemo(
    () => priceableOffers
      .filter((o) => (quantities[o.id] ?? 0) > 0)
      .map((o) => ({ designation: o.title, quantite: quantities[o.id], prixUnitaireHT: o.priceHT as number })),
    [priceableOffers, quantities],
  )
  const estimatedTotal = useMemo(
    () => selectedItems.reduce((sum, it) => sum + it.quantite * it.prixUnitaireHT, 0),
    [selectedItems],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.clientNom.trim() || selectedItems.length === 0) {
      setFormError(t.errorRequired)
      return
    }
    setSubmitting(true)
    try {
      const quote = await submitQuote({
        clientNom: form.clientNom.trim(),
        clientSociete: form.clientSociete.trim() || undefined,
        clientAdresse: form.clientAdresse.trim() || undefined,
        clientEmail: form.clientEmail.trim() || undefined,
        clientTelephone: form.clientTelephone.trim() || undefined,
        descriptionProjet: form.descriptionProjet.trim() || t.formTitle,
        items: selectedItems,
      })
      setCreatedQuote(quote)
    } catch {
      setFormError(t.errorGeneric)
    } finally {
      setSubmitting(false)
    }
  }

  const startNewQuote = () => {
    setCreatedQuote(null)
    setForm(EMPTY_FORM)
    setQuantities({})
  }

  // ── Lookup an existing quote (also used by the "quote accepted" email's
  // ?ref= link, which lands here to view the contract) ──
  const [lookupRef, setLookupRef] = useState('')
  const [lookupResult, setLookupResult] = useState<Quote | null>(null)
  const [lookupSearching, setLookupSearching] = useState(false)
  const [lookupError, setLookupError] = useState('')

  const runLookup = async (ref: string) => {
    if (!ref.trim()) return
    setLookupSearching(true)
    setLookupError('')
    setLookupResult(null)
    try {
      const quote = await lookupQuote(ref)
      if (quote) setLookupResult(quote)
      else setLookupError(t.lookupNotFound)
    } catch {
      setLookupError(t.errorGeneric)
    } finally {
      setLookupSearching(false)
    }
  }

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from the "quote accepted" email link
      setLookupRef(ref)
      runLookup(ref)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative">
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <FadeIn>
          <p className="section-label mb-3">{t.label}</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>{t.title}</h1>
          <p className="text-lg mb-12" style={{ color: 'var(--text-muted)', maxWidth: 560 }}>{t.subtitle}</p>
        </FadeIn>

        {createdQuote ? (
          <FadeIn>
            <div className="card p-8 text-center mb-10">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(0,128,0,0.1)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#008000" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <p className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>{createdQuote.numero}</p>
              <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>{fmt(createdQuote.totalTTC)} TTC</p>
              <button onClick={startNewQuote} className="btn-secondary btn-sm">{t.newQuoteButton}</button>
            </div>
          </FadeIn>
        ) : (
          <FadeIn delay={0.05}>
            <form onSubmit={handleSubmit} className="card p-8 space-y-5 mb-10">
              <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text)' }}>{t.formTitle}</h2>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="dv-nom" className={fieldLabel} style={labelStyle}>{t.nameLabel}</label>
                  <input id="dv-nom" name="clientNom" value={form.clientNom} onChange={handleChange} required maxLength={100} placeholder={t.namePlaceholder} className="input" />
                </div>
                <div>
                  <label htmlFor="dv-societe" className={fieldLabel} style={labelStyle}>{t.companyLabel}</label>
                  <input id="dv-societe" name="clientSociete" value={form.clientSociete} onChange={handleChange} maxLength={100} placeholder={t.companyPlaceholder} className="input" />
                </div>
                <div>
                  <label htmlFor="dv-email" className={fieldLabel} style={labelStyle}>{t.emailLabel}</label>
                  <input id="dv-email" type="email" name="clientEmail" value={form.clientEmail} onChange={handleChange} maxLength={200} placeholder={t.emailPlaceholder} className="input" />
                </div>
                <div>
                  <label htmlFor="dv-tel" className={fieldLabel} style={labelStyle}>{t.phoneLabel}</label>
                  <input id="dv-tel" name="clientTelephone" value={form.clientTelephone} onChange={handleChange} maxLength={30} placeholder={t.phonePlaceholder} className="input" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="dv-adresse" className={fieldLabel} style={labelStyle}>{t.addressLabel}</label>
                  <input id="dv-adresse" name="clientAdresse" value={form.clientAdresse} onChange={handleChange} maxLength={200} placeholder={t.addressPlaceholder} className="input" />
                </div>
              </div>

              <div>
                <label htmlFor="dv-description" className={fieldLabel} style={labelStyle}>{t.descriptionLabel}</label>
                <textarea id="dv-description" name="descriptionProjet" value={form.descriptionProjet} onChange={handleChange} rows={4} maxLength={1500} placeholder={t.descriptionPlaceholder} className="input" style={{ resize: 'none' }} />
              </div>

              <div>
                <p className={fieldLabel} style={labelStyle}>{t.offersLabel}</p>
                {priceableOffers.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>{t.noOffers}</p>
                ) : (
                  <div className="space-y-2">
                    {priceableOffers.map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-3 p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{o.title}</p>
                          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{fmt(o.priceHT as number)} HT</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <label htmlFor={`qty-${o.id}`} className="text-xs" style={{ color: 'var(--text-subtle)' }}>{t.quantityLabel}</label>
                          <input
                            id={`qty-${o.id}`}
                            type="number" min={0} max={99}
                            value={quantities[o.id] ?? 0}
                            onChange={(e) => setQty(o.id, Number(e.target.value))}
                            className="input text-sm text-center"
                            style={{ width: '4rem', padding: '0.4rem' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedItems.length > 0 && (
                <div className="flex items-center justify-between p-3" style={{ background: 'var(--accent-glow)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t.totalPreviewLabel}</span>
                  <span className="font-display font-bold" style={{ color: 'var(--accent)' }}>{fmt(estimatedTotal)}</span>
                </div>
              )}

              {formError && (
                <p className="text-sm px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>{formError}</p>
              )}

              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
                {submitting ? t.submitting : t.submit}
              </button>
            </form>
          </FadeIn>
        )}

        <FadeIn delay={0.1}>
          <div className="card p-6">
            <h2 className="font-display font-semibold text-base mb-4" style={{ color: 'var(--text)' }}>{t.lookupTitle}</h2>
            <div className="flex gap-2 flex-wrap">
              <input
                value={lookupRef}
                onChange={(e) => setLookupRef(e.target.value)}
                placeholder={t.lookupPlaceholder}
                className="input"
                style={{ flex: '1 1 200px' }}
              />
              <button onClick={() => runLookup(lookupRef)} disabled={lookupSearching} className="btn-secondary flex-shrink-0">
                {lookupSearching ? t.lookupSearching : t.lookupButton}
              </button>
            </div>
            {lookupError && <p className="text-sm mt-3" style={{ color: '#EF4444' }}>{lookupError}</p>}
          </div>
        </FadeIn>
      </div>

      {createdQuote && <QuoteView quote={createdQuote} onClose={() => setCreatedQuote(null)} />}
      {lookupResult && (
        <QuoteView
          quote={lookupResult}
          onClose={() => setLookupResult(null)}
          variant={lookupResult.status === 'accepted' ? 'contrat' : 'devis'}
        />
      )}
    </div>
  )
}
