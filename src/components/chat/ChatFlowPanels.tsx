'use client'

import { useState } from 'react'
import { sendQuoteEmail } from '@/actions/quotes'
import { formatSlotDay, slotMessage, summarizeQuoteDraft, visibleSlotDays, type QuoteDraftInput, type SlotDay } from '@/lib/chat-flows'
import type { HintChip, PageSuggestions } from '@/lib/chat-page-context'
import type { ChatLocale } from '@/lib/chat-services'

// Panels for the visitor chat's flows. They show what the assistant found or understood and
// every button either sends an ordinary message or runs the action the visitor asked for.

const T = {
  fr: {
    slotsTitle: 'Créneaux disponibles',
    slotsHint: 'Heures de Libreville (UTC+1). Touchez un créneau pour le choisir.',
    noSlots: 'Aucun créneau disponible pour le moment.',
    slotLabel: (day: string, time: string) => `Choisir ${day} à ${time}`,
    confirmTitle: "Voici ce que j'ai compris de votre projet",
    client: 'Client',
    project: 'Projet',
    line: 'Prestation',
    total: 'Total HT indicatif',
    confirmNote: "Le devis final détaille les taxes. Vous pouvez le modifier ou le refuser ensuite, rien ne vous engage avant votre signature.",
    confirm: 'Générer mon devis',
    edit: 'Modifier',
    generating: 'Génération du devis…',
    qty: 'qté',
    emailCopy: 'M’envoyer ce devis par e-mail',
    emailTo: (e: string) => `Envoyer à ${e}`,
    emailLabel: 'Votre e-mail',
    emailSend: 'Envoyer',
    emailSending: 'Envoi…',
    emailDone: 'Le devis a été envoyé par e-mail.',
    pageLabel: 'Page',
  },
  en: {
    slotsTitle: 'Available slots',
    slotsHint: 'Libreville time (UTC+1). Tap a slot to choose it.',
    noSlots: 'No slots available right now.',
    slotLabel: (day: string, time: string) => `Choose ${day} at ${time}`,
    confirmTitle: "Here is what I understood about your project",
    client: 'Client',
    project: 'Project',
    line: 'Service',
    total: 'Indicative total excl. tax',
    confirmNote: 'The final quote itemises taxes. You can change or decline it afterwards: nothing binds you before you sign.',
    confirm: 'Generate my quote',
    edit: 'Change',
    generating: 'Generating the quote…',
    qty: 'qty',
    emailCopy: 'Email me this quote',
    emailTo: (e: string) => `Send to ${e}`,
    emailLabel: 'Your email',
    emailSend: 'Send',
    emailSending: 'Sending…',
    emailDone: 'The quote was sent by email.',
    pageLabel: 'Page',
  },
} as const

const box = { border: '1px solid var(--border)', background: 'var(--surface-hover)', color: 'var(--text)' } as const
const small = { fontSize: '0.75rem', padding: '0.4rem 0.8rem' } as const
const fcfa = (n: number, locale: ChatLocale) => `${Math.round(n).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR')} FCFA`

/** The free slots, one button each. A tap sends one ordinary message, so the visitor stays in charge. */
export function SlotPicker({ days, locale, busy, onPick }: { days: SlotDay[]; locale: ChatLocale; busy: boolean; onPick: (message: string) => void }) {
  const t = T[locale]
  const shown = visibleSlotDays(days)
  if (shown.length === 0) return <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{t.noSlots}</p>
  return (
    <div className="space-y-2.5" data-testid="chat-slots">
      <p className="text-xs font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>{t.slotsTitle}</p>
      {shown.map((d) => (
        <div key={d.date}>
          <p className="text-xs capitalize mb-1" style={{ color: 'var(--text-muted)' }}>{formatSlotDay(locale, d.date)}</p>
          <div className="flex flex-wrap gap-1.5">
            {d.slots.map((time) => (
              <button
                key={time} type="button" disabled={busy} data-slot={`${d.date}T${time}`}
                aria-label={t.slotLabel(formatSlotDay(locale, d.date), time)}
                onClick={() => onPick(slotMessage(locale, d.date, time))}
                className="text-xs font-medium px-2.5 py-1.5 transition-colors hover:bg-[var(--brand, var(--accent))] hover:text-[var(--brand-contrast, var(--accent-contrast))] disabled:opacity-50"
                style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{t.slotsHint}</p>
    </div>
  )
}

/** The summary of the quote the assistant is about to generate: the visitor confirms or asks to change it. */
export function QuoteConfirm({ input, locale, busy, onConfirm, onEdit }: { input: QuoteDraftInput; locale: ChatLocale; busy: boolean; onConfirm: () => void; onEdit: () => void }) {
  const t = T[locale]
  const s = summarizeQuoteDraft(input, locale)
  return (
    <div className="p-3 space-y-2.5" style={{ ...box, border: '1px solid var(--brand, var(--accent))', maxWidth: '100%' }} data-testid="chat-quote-confirm">
      <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-poppins)' }}>{t.confirmTitle}</p>
      <dl className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
        {s.client && <div className="flex gap-2"><dt className="font-semibold flex-shrink-0" style={{ color: 'var(--text)' }}>{t.client}</dt><dd className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{s.client}</dd></div>}
        {s.project && <div className="flex gap-2"><dt className="font-semibold flex-shrink-0" style={{ color: 'var(--text)' }}>{t.project}</dt><dd className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{s.project}</dd></div>}
        {s.brief.map((b) => <div key={b.key} className="flex gap-2"><dt className="font-semibold flex-shrink-0" style={{ color: 'var(--text)' }}>{b.key}</dt><dd className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{b.value}</dd></div>)}
      </dl>
      {s.lines.length > 0 && (
        <ul className="text-xs" style={{ borderTop: '1px solid var(--border)' }}>
          {s.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{l.designation}{l.quantity > 1 ? ` · ${t.qty} ${l.quantity}` : ''}</span>
              <span className="flex-shrink-0 font-medium">{fcfa(l.total, locale)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 py-1.5 font-bold" data-testid="chat-quote-total"><span>{t.total}</span><span>{fcfa(s.totalHT, locale)}</span></li>
        </ul>
      )}
      <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{t.confirmNote}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || s.lines.length === 0} onClick={onConfirm} className="btn-primary btn-sm" style={small}>{busy ? t.generating : t.confirm}</button>
        <button type="button" disabled={busy} onClick={onEdit} className="btn-secondary btn-sm" style={small}>{t.edit}</button>
      </div>
    </div>
  )
}

/** "Email me this quote": uses the address already on the quote, or asks for one. The visitor clicks, the visitor chooses. */
export function EmailCopyButton({ accessCode, clientEmail, locale }: { accessCode: string; clientEmail?: string; locale: ChatLocale }) {
  const t = T[locale]
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const send = async (to: string) => {
    setState('sending')
    try {
      const r = await sendQuoteEmail(accessCode, to)
      setState(r.ok ? 'done' : 'error')
      setMessage(r.ok ? t.emailDone : r.message)
    } catch {
      setState('error')
      setMessage(locale === 'en' ? 'Could not send the email.' : "Impossible d'envoyer l'e-mail.")
    }
  }

  if (state === 'done') return <p role="status" className="text-xs" data-testid="chat-email-done" style={{ color: 'var(--text)' }}>{message}</p>
  if (clientEmail) {
    return (
      <>
        <button type="button" disabled={state === 'sending'} onClick={() => send(clientEmail)} className="btn-secondary btn-sm" style={small}>{state === 'sending' ? t.emailSending : t.emailTo(clientEmail)}</button>
        {state === 'error' && <p role="alert" className="text-xs w-full" style={{ color: '#D90000' }}>{message}</p>}
      </>
    )
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm" style={small}>{t.emailCopy}</button>
  return (
    <form className="flex flex-wrap items-center gap-2 w-full" onSubmit={(e) => { e.preventDefault(); if (email.trim()) send(email.trim()) }}>
      <label htmlFor={`quote-email-${accessCode}`} className="sr-only">{t.emailLabel}</label>
      <input id={`quote-email-${accessCode}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailLabel} autoComplete="email" className="input text-sm flex-1" style={{ minWidth: 0 }} />
      <button type="submit" disabled={state === 'sending' || !email.trim()} className="btn-primary btn-sm" style={small}>{state === 'sending' ? t.emailSending : t.emailSend}</button>
      {state === 'error' && <p role="alert" className="text-xs w-full" style={{ color: '#D90000' }}>{message}</p>}
    </form>
  )
}

/** "Page: …" and the chips that fit it, above the standard suggestions. */
export function PageHintBox({ suggestions, locale, busy, onChip }: { suggestions: PageSuggestions; locale: ChatLocale; busy: boolean; onChip: (chip: HintChip) => void }) {
  const t = T[locale]
  return (
    <div className="px-3 py-2.5" data-testid="chat-page-hint" style={{ border: '1px dashed var(--brand, var(--accent))', background: 'var(--surface-hover)' }}>
      <p className="text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
        <span className="font-bold tracking-wider uppercase text-[10px]" style={{ color: 'var(--text)' }}>{t.pageLabel} : </span>{suggestions.label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.chips.map((chip) => (
          <button key={chip.label} type="button" disabled={busy} onClick={() => onChip(chip)} className="text-xs px-2.5 py-1.5 transition-colors hover:bg-[var(--brand, var(--accent))] hover:text-[var(--brand-contrast, var(--accent-contrast))] disabled:opacity-50" style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}
