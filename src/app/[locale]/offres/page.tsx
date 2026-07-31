'use client'

import { useEffect, useState } from 'react'
import FadeIn from '@/components/animations/FadeIn'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { translateText } from '@/actions/translate'
import { openChatWithMessage } from '@/lib/chat-bridge'
import type { Offer } from '@/types'

type Translated = Record<string, { title: string; description: string; features: string }>

function OfferCard({ offer, tr, ctaLabel, onRequest, highlighted }: {
  offer: Offer
  tr?: { title: string; description: string; features: string }
  ctaLabel: string
  onRequest: (title: string) => void
  highlighted?: boolean
}) {
  const title = tr?.title || offer.title
  const description = tr?.description || offer.description
  const features = tr ? tr.features.split('\n').filter(Boolean) : (offer.features ?? [])

  return (
    <div
      className="card p-6 h-full flex flex-col"
      style={highlighted ? { border: '1px solid var(--accent)', boxShadow: 'var(--shadow-glow)' } : undefined}
    >
      <h3 className="font-display font-semibold text-xl mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
      <p className="text-sm leading-relaxed mb-4 flex-1" style={{ color: 'var(--text-muted)' }}>{description}</p>

      {features.length > 0 && (
        <ul className="space-y-2 mb-5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {f}
            </li>
          ))}
        </ul>
      )}

      <p className="font-display font-bold text-lg mb-4" style={{ color: 'var(--accent)' }}>{offer.priceLabel}</p>

      <button onClick={() => onRequest(title)} className="btn-primary w-full justify-center text-sm">
        {ctaLabel}
      </button>
    </div>
  )
}

export default function OffersPage() {
  const { data } = usePortfolio()
  const locale = useLocale()
  const t = useDictionary()

  const [translated, setTranslated] = useState<Translated>({})

  useEffect(() => {
    if (locale !== 'en' || data.offers.length === 0) { setTranslated({}); return } // eslint-disable-line react-hooks/set-state-in-effect
    let cancelled = false
    Promise.all(
      data.offers.map(async (o) => {
        const fields = await translateText(`offer:${o.id}`, 'en', {
          title: o.title,
          description: o.description,
          features: (o.features ?? []).join('\n'),
        })
        return [o.id, { title: fields.title ?? o.title, description: fields.description ?? o.description, features: fields.features ?? '' }] as const
      }),
    ).then((entries) => { if (!cancelled) setTranslated(Object.fromEntries(entries)) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, data.offers.length])

  const special = data.offers.filter((o) => o.featured)
  const regular = data.offers.filter((o) => !o.featured)

  const requestQuote = (title: string) => openChatWithMessage(t.offers.ctaMessage(title))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <FadeIn>
        <p className="section-label mb-3">{t.offers.label}</p>
        <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
          {t.offers.title}
        </h1>
        <p className="text-lg mb-16" style={{ color: 'var(--text-muted)', maxWidth: 560 }}>
          {t.offers.subtitle}
        </p>
      </FadeIn>

      {data.offers.length === 0 ? (
        <p className="py-10 text-center" style={{ color: 'var(--text-muted)' }}>{t.offers.empty}</p>
      ) : (
        <>
          {special.length > 0 && (
            <div className="mb-16">
              <FadeIn>
                <p className="section-label mb-6">{t.offers.specialTitle}</p>
              </FadeIn>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {special.map((o, i) => (
                  <FadeIn key={o.id} delay={Math.min(i * 0.07, 0.28)}>
                    <OfferCard offer={o} tr={translated[o.id]} ctaLabel={t.offers.cta} onRequest={requestQuote} highlighted />
                  </FadeIn>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {regular.map((o, i) => (
              <FadeIn key={o.id} delay={Math.min(i * 0.07, 0.28)}>
                <OfferCard offer={o} tr={translated[o.id]} ctaLabel={t.offers.cta} onRequest={requestQuote} />
              </FadeIn>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
