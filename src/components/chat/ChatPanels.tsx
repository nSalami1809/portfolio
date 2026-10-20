'use client'

import { useState } from 'react'
import type { Offer } from '@/types'
import {
  PRICE_DISCLAIMER, bookingHref, contactHref, fromPriceLabel, normalizeAccessCode, quoteProgress, quoteRequestMessage, serviceCards, trackingHref,
  trackingMessage, type ChatLocale, type QuoteLike,
} from '@/lib/chat-services'

// Small panels of the visitor chat. They show the site's real data (offers, the quote
// being tracked) and send nothing by themselves: every button either opens a page or
// puts a normal message in the conversation.

const S = {
  fr: {
    back: 'Retour',
    servicesTitle: 'Nos prestations',
    loading: 'Chargement…',
    servicesEmpty: "Les prestations ne sont pas disponibles pour le moment. Demandez-moi un devis : je m'adapte à votre projet.",
    siteGrid: 'Tarif du site',
    requestQuote: 'Demander un devis',
    trackTitle: 'Suivre mon devis',
    trackHelp: "Saisissez le code d'accès à 6 caractères donné avec votre devis.",
    trackLabel: "Code d'accès",
    trackInvalid: 'Ce code ne ressemble pas à un code de devis (6 caractères, sans O, I, 0 ni 1).',
    trackOpen: "Voir l'avancement",
    trackAsk: 'Demander à NemCopilotIA',
    talk: 'Parler à Nawaf',
    write: 'Écrire à Nawaf',
    book: 'Réserver un appel',
    whatsapp: 'WhatsApp',
    handoffTitle: 'Une réponse plus rapide ?',
    progress: 'Avancement du devis',
    declined: 'Devis refusé',
  },
  en: {
    back: 'Back',
    servicesTitle: 'Services',
    loading: 'Loading…',
    servicesEmpty: 'Services are not available right now. Ask me for a quote: I adapt to your project.',
    siteGrid: 'Rate on the site',
    requestQuote: 'Request a quote',
    trackTitle: 'Track my quote',
    trackHelp: 'Enter the 6-character access code given with your quote.',
    trackLabel: 'Access code',
    trackInvalid: "That doesn't look like a quote code (6 characters, no O, I, 0 or 1).",
    trackOpen: 'See the progress',
    trackAsk: 'Ask NemCopilotIA',
    talk: 'Talk to Nawaf',
    write: 'Write to Nawaf',
    book: 'Book a call',
    whatsapp: 'WhatsApp',
    handoffTitle: 'Need a faster answer?',
    progress: 'Quote progress',
    declined: 'Quote declined',
  },
} as const

const box = { border: '1px solid var(--border)', background: 'var(--surface-hover)', color: 'var(--text)' } as const
const small = { fontSize: '0.75rem', padding: '0.4rem 0.8rem' } as const

export function ServiceCards({ offers, failed, locale, busy, onRequestQuote, onBack }: { offers: Offer[] | null; failed: boolean; locale: ChatLocale; busy: boolean; onRequestQuote: (message: string) => void; onBack: () => void }) {
  const t = S[locale]
  const cards = serviceCards(offers ?? [])
  return (
    <div className="space-y-2.5" data-testid="chat-services">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>{t.servicesTitle}</p>
        <button type="button" onClick={onBack} className="text-xs underline" style={{ color: 'var(--text-muted)' }}>{t.back}</button>
      </div>
      {offers === null && !failed && <p role="status" className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.loading}</p>}
      {(failed || (offers !== null && cards.length === 0)) && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.servicesEmpty}</p>}
      {cards.map((card) => (
        <article key={card.id} className="p-3" style={box}>
          <h3 className="text-sm font-bold mb-0.5" style={{ fontFamily: 'var(--font-poppins)' }}>{card.title}</h3>
          {card.summary && <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{card.summary}</p>}
          {card.features.length > 0 && (
            <ul className="text-xs mb-2 space-y-0.5" style={{ color: 'var(--text-muted)' }}>
              {card.features.map((f) => <li key={f} className="flex gap-1.5"><span aria-hidden="true">·</span><span>{f}</span></li>)}
            </ul>
          )}
          <p className="text-sm font-semibold" data-testid="chat-service-price" style={{ color: 'var(--text)' }}>{fromPriceLabel(locale, card.price)}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
            {PRICE_DISCLAIMER[locale]}{card.priceDetail ? ` ${t.siteGrid} : ${card.priceDetail}.` : ''}
          </p>
          <button type="button" disabled={busy} onClick={() => onRequestQuote(quoteRequestMessage(locale, card.title))} className="btn-primary btn-sm mt-2.5" style={small}>{t.requestQuote}</button>
        </article>
      ))}
    </div>
  )
}

export function QuoteTracker({ locale, busy, onAsk, onBack }: { locale: ChatLocale; busy: boolean; onAsk: (message: string) => void; onBack: () => void }) {
  const t = S[locale]
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const code = normalizeAccessCode(value)
  const invalid = touched && value.trim() !== '' && !code
  return (
    <div className="space-y-2.5 p-3" style={box} data-testid="chat-tracker">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-poppins)' }}>{t.trackTitle}</p>
        <button type="button" onClick={onBack} className="text-xs underline" style={{ color: 'var(--text-muted)' }}>{t.back}</button>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.trackHelp}</p>
      <label htmlFor="chat-track-code" className="sr-only">{t.trackLabel}</label>
      <input
        id="chat-track-code" value={value} maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        onChange={(e) => { setValue(e.target.value); setTouched(true) }}
        placeholder="ABC234" aria-invalid={invalid} className="input text-sm w-full" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}
      />
      {invalid && <p role="alert" className="text-xs" style={{ color: '#D90000' }}>{t.trackInvalid}</p>}
      <div className="flex flex-wrap gap-2">
        {code ? <a className="btn-primary btn-sm" style={small} href={trackingHref(locale, code)} target="_blank" rel="noopener noreferrer">{t.trackOpen}</a> : <span className="btn-primary btn-sm opacity-40" style={small} aria-disabled="true">{t.trackOpen}</span>}
        <button type="button" disabled={!code || busy} onClick={() => code && onAsk(trackingMessage(locale, code))} className="btn-secondary btn-sm" style={small}>{t.trackAsk}</button>
      </div>
    </div>
  )
}

export function QuoteProgress({ quote, locale }: { quote: QuoteLike; locale: ChatLocale }) {
  const t = S[locale]
  const { steps, declined } = quoteProgress(quote, locale)
  return (
    <div className="mt-3" data-testid="chat-quote-progress" aria-label={t.progress}>
      {declined ? (
        <p className="text-xs font-semibold" style={{ color: '#D90000' }}>{t.declined}</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-0.5" role="list">
            {steps.map((s) => <span key={s.key} role="listitem" aria-label={`${s.label}${s.done ? ' ✓' : ''}`} className="block h-1" style={{ background: s.done ? 'var(--accent)' : 'var(--border)' }} />)}
          </div>
          <div className="grid grid-cols-4 gap-0.5 mt-1">
            {steps.map((s) => <span key={s.key} className="text-[10px] leading-tight" style={{ color: s.done ? 'var(--text)' : 'var(--text-subtle)' }}>{s.label}</span>)}
          </div>
        </>
      )}
    </div>
  )
}

/** Ways to reach the owner directly, shown when the bot cannot help or is unavailable. */
export function HandoffLinks({ locale, lastQuestion, whatsapp, title }: { locale: ChatLocale; lastQuestion: string; whatsapp?: string; title?: boolean }) {
  const t = S[locale]
  const wa = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : ''
  return (
    <div className="p-3 space-y-2" style={{ border: '1px solid var(--brand)', background: 'var(--surface-hover)' }} data-testid="chat-handoff">
      {title !== false && <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>{t.handoffTitle}</p>}
      <div className="flex flex-wrap gap-2">
        <a className="btn-primary btn-sm" style={small} href={contactHref(locale, lastQuestion)}>{t.write}</a>
        <a className="btn-secondary btn-sm" style={small} href={bookingHref(locale)}>{t.book}</a>
        {wa && <a className="btn-secondary btn-sm" style={small} href={wa} target="_blank" rel="noopener noreferrer">{t.whatsapp}</a>}
      </div>
    </div>
  )
}

export const talkLabel = (locale: ChatLocale) => S[locale].talk

const THUMBS = {
  fr: { up: 'Réponse utile', down: 'Réponse à améliorer', thanks: 'Merci pour votre retour' },
  en: { up: 'Helpful answer', down: 'Answer to improve', thanks: 'Thanks for your feedback' },
} as const

/** Thumbs under an answer: the visitor's signal of what the assistant gets right or wrong. */
export function ThumbButtons({ rating, locale, onRate }: { rating: 'up' | 'down' | null; locale: ChatLocale; onRate: (value: 'up' | 'down') => void }) {
  const t = THUMBS[locale]
  const base = { width: 26, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' } as const
  const icon = (flip: boolean) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={flip ? { transform: 'rotate(180deg)' } : undefined}>
      <path d="M7 10v11H3V10zM7 10l4-8a3 3 0 0 1 3 3v3h5.5a2 2 0 0 1 2 2.3l-1.4 8a2 2 0 0 1-2 1.7H7" />
    </svg>
  )
  return (
    <div className="flex items-center gap-1.5" style={{ paddingLeft: 32 }} data-testid="chat-thumbs">
      <button type="button" aria-label={t.up} aria-pressed={rating === 'up'} onClick={() => onRate('up')} style={{ ...base, background: rating === 'up' ? 'var(--accent)' : 'transparent', color: rating === 'up' ? 'var(--accent-contrast)' : 'var(--text-subtle)' }}>{icon(false)}</button>
      <button type="button" aria-label={t.down} aria-pressed={rating === 'down'} onClick={() => onRate('down')} style={{ ...base, background: rating === 'down' ? 'var(--accent)' : 'transparent', color: rating === 'down' ? 'var(--accent-contrast)' : 'var(--text-subtle)' }}>{icon(true)}</button>
      {rating && <span role="status" className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{t.thanks}</span>}
    </div>
  )
}
