'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { translateText } from '@/actions/translate'
import { openChatWithMessage } from '@/lib/chat-bridge'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import type { Offer } from '@/types'

type Translated = Record<string, { title: string; description: string; features: string }>
type OffersDict = ReturnType<typeof useDictionary>['offers']

const HERO_INTERVAL_MS = 10000

function PauseIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
}
function PlayIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20"/></svg>
}

function OffersHero({ offers, translated, t, ctaLabel, onRequest }: {
  offers: Offer[]
  translated: Translated
  t: OffersDict
  ctaLabel: string
  onRequest: (title: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [tabHidden, setTabHidden] = useState(false)
  const reduceMotion = usePrefersReducedMotion()

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (index >= offers.length) setIndex(0) // eslint-disable-line react-hooks/set-state-in-effect
  }, [offers.length, index])

  const paused = userPaused || tabHidden || reduceMotion || offers.length <= 1

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setIndex((i) => (i + 1) % offers.length), HERO_INTERVAL_MS)
    return () => clearInterval(id)
  }, [paused, offers.length])

  if (offers.length === 0) return null
  const o = offers[index]
  const tr = translated[o.id]
  const title = tr?.title || o.title
  const description = tr?.description || o.description

  return (
    <div className="relative mb-16 rounded-3xl overflow-hidden card no-lift" style={{ minHeight: '340px' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={o.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="grid md:grid-cols-2 gap-8 items-center p-8 sm:p-12"
        >
          <div>
            {o.featured && <span className="tag text-xs mb-3 inline-block">{t.specialTitle}</span>}
            <h2 className="font-display font-bold text-2xl sm:text-3xl mb-3" style={{ color: 'var(--text)' }}>{title}</h2>
            <p className="text-sm sm:text-base leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>{description}</p>
            <p className="font-display font-bold text-xl mb-6" style={{ color: 'var(--accent)' }}>{o.priceLabel}</p>
            <button onClick={() => onRequest(title)} className="btn-primary text-sm">{ctaLabel}</button>
          </div>
          {o.image ? (
            <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
              <Image src={o.image} alt={title} fill sizes="(min-width: 768px) 45vw, 90vw" style={{ objectFit: 'cover' }} priority={index === 0} />
            </div>
          ) : (
            <div className="hidden md:block" aria-hidden="true" />
          )}
        </motion.div>
      </AnimatePresence>

      {offers.length > 1 && (
        <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-2">
          {offers.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setIndex(i)}
              aria-label={t.heroGoTo(translated[slide.id]?.title || slide.title)}
              aria-current={i === index}
              className="rounded-full transition-all duration-300"
              style={{ width: i === index ? '20px' : '6px', height: '6px', background: i === index ? 'var(--accent)' : 'var(--border)' }}
            />
          ))}
          <button
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? t.heroPlay : t.heroPause}
            className="ml-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            {userPaused ? <PlayIcon /> : <PauseIcon />}
          </button>
        </div>
      )}
    </div>
  )
}

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
      className="card p-6 h-full flex flex-col overflow-hidden"
      style={highlighted ? { border: '1px solid var(--accent)', boxShadow: 'var(--shadow-glow)' } : undefined}
    >
      {offer.image && (
        <div className="relative -mx-6 -mt-6 mb-5" style={{ aspectRatio: '16 / 9' }}>
          <Image src={offer.image} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" style={{ objectFit: 'cover' }} />
        </div>
      )}
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
          <OffersHero offers={data.offers} translated={translated} t={t.offers} ctaLabel={t.offers.cta} onRequest={requestQuote} />

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
