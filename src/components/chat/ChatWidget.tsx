'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { motion, AnimatePresence } from 'framer-motion'
import type { Quote } from '@/actions/quotes'
import type { Booking } from '@/actions/bookings'
import { requestHumanHelp } from '@/actions/escalation'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { onOpenChatRequest } from '@/lib/chat-bridge'
import type { Dictionary } from '@/lib/i18n/dictionaries'

// Only needed once a visitor actually opens a generated devis (QR code lib
// included) — keep it split out of the widget's own chunk until then.
const QuoteView = dynamic(() => import('./QuoteView'), { ssr: false })

// react-markdown + remark-gfm — only needed once an actual bot message
// needs rendering, not the instant the (closed) chat bubble mounts.
const ChatMarkdown = dynamic(() => import('./ChatMarkdown'), { ssr: false })

type BotMood = 'idle' | 'thinking' | 'happy' | 'excited' | 'confused'

function moodForText(text: string): BotMood {
  const t = text.toLowerCase()
  if (/d[ée]sol[ée]|je n(?:'| )ai pas|aucune information|je ne sais pas|malheureusement|je ne peux pas|sorry|i don't have|i don't know|unfortunately|i can't/.test(t)) return 'confused'
  if (/devis|quote|f[ée]licitations|congratulations|g[ée]n[ée]r[ée] avec succ[eè]s|generated successfully|c'est parti|let's go|excellente nouvelle|great news/.test(t)) return 'excited'
  if (/bonjour|hello|hi there|bienvenue|welcome|ravi|glad|super|great|avec plaisir|with pleasure|content de|happy to/.test(t)) return 'happy'
  return 'idle'
}

function BotIcon({ mood = 'idle', ...props }: React.SVGProps<SVGSVGElement> & { mood?: BotMood }) {
  const eyeOrigin = { transformBox: 'fill-box' as const, transformOrigin: 'center' as const }
  const bigEyes = mood === 'happy' || mood === 'excited'
  const tilt = mood === 'confused'

  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={tilt ? { rotate: [-7, 7, -7] } : { rotate: 0 }}
        transition={tilt ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        {/* antenna */}
        <motion.circle
          cx="12" cy="2.6" r="1.15" fill="currentColor"
          animate={
            mood === 'thinking' ? { opacity: [1, 0.35, 1] }
            : mood === 'excited' ? { y: [0, -1.3, 0] }
            : { opacity: 1, y: 0 }
          }
          transition={
            mood === 'thinking' ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
            : mood === 'excited' ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
            : undefined
          }
        />
        <line x1="12" y1="3.75" x2="12" y2="6.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        {/* ears */}
        <rect x="2.2" y="10.3" width="2.3" height="5" rx="1.15" fill="currentColor" />
        <rect x="19.5" y="10.3" width="2.3" height="5" rx="1.15" fill="currentColor" />
        {/* head */}
        <rect x="4.6" y="6.2" width="14.8" height="14" rx="5" stroke="currentColor" strokeWidth="1.7" />
        {/* eyes */}
        {mood === 'thinking' ? (
          <>
            <motion.circle
              cy="13.1" r="1.55" fill="currentColor"
              animate={{ cx: [9.7, 10.3, 9.7] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
              cy="13.1" r="1.55" fill="currentColor"
              animate={{ cx: [14.3, 14.9, 14.3] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : mood === 'confused' ? (
          <>
            <circle cx="9.7" cy="13.5" r="1.4" fill="currentColor" style={eyeOrigin} transform="scale(1,0.6)" />
            <circle cx="14.3" cy="12.85" r="1.6" fill="currentColor" />
          </>
        ) : (
          <>
            <motion.circle
              cx="9.7" cy="13.1" r={bigEyes ? 1.75 : 1.55} fill="currentColor"
              style={eyeOrigin}
              animate={{ scaleY: [1, 1, 0.12, 1] }}
              transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.92, 0.96, 1], ease: 'easeInOut' }}
            />
            <motion.circle
              cx="14.3" cy="13.1" r={bigEyes ? 1.75 : 1.55} fill="currentColor"
              style={eyeOrigin}
              animate={{ scaleY: [1, 1, 0.12, 1] }}
              transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.92, 0.96, 1], ease: 'easeInOut' }}
            />
          </>
        )}
        {/* mouth */}
        {mood === 'thinking' ? (
          <line x1="9.8" y1="16.85" x2="14.2" y2="16.85" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : mood === 'confused' ? (
          <path d="M9.6 17.1q1.1-1 2.2 0t2.2 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        ) : mood === 'excited' ? (
          <path d="M8.7 16.1c1.4 1.7 5.2 1.7 6.6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : mood === 'happy' ? (
          <path d="M8.9 16.3c1.3 1.4 5 1.4 6.2 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        ) : (
          <path d="M9.3 16.6c1 .95 4.4.95 5.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </motion.g>
    </svg>
  )
}

function BotAvatar({ mood }: { mood: BotMood }) {
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: 'var(--accent-gradient)' }}
      aria-hidden="true"
    >
      <BotIcon width={13} height={13} color="white" mood={mood} />
    </div>
  )
}

function BookingCard({ booking, t }: { booking: Booking; t: Dictionary['chat'] }) {
  const when = new Date(booking.start).toLocaleString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Libreville',
  })
  return (
    <div className="rounded-xl p-3.5" style={{ maxWidth: '85%', background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}>
      <p className="text-xs font-bold mb-1 capitalize" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>{t.bookingPrefix}</p>
      <p className="text-sm font-semibold mb-1 capitalize" style={{ color: 'var(--text)' }}>{when}</p>
      {booking.status === 'cancelled' && (
        <p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>{t.bookingCancelled}</p>
      )}
      <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>{booking.clientNom}</p>
      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
        {t.trackingCode} : <strong style={{ color: 'var(--text)', letterSpacing: '0.05em' }}>{booking.accessCode}</strong>
      </p>
    </div>
  )
}

function QuoteCard({ quote, onView, adminEmail, t }: { quote: Quote; onView: () => void; adminEmail?: string; t: Dictionary['chat'] }) {
  const callHref = adminEmail
    ? `mailto:${adminEmail}?subject=${encodeURIComponent(`${t.callSubject} ${quote.numero}`)}&body=${encodeURIComponent(`${t.callBodyIntro} ${quote.numero} (${quote.clientNom}).\n\n${t.callBodyOutro}`)}`
    : undefined

  return (
    <div
      className="rounded-xl p-3.5"
      style={{ maxWidth: '85%', background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}
    >
      <p className="text-xs font-bold mb-1" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>
        {t.quotePrefix} {quote.numero}
      </p>
      <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>{quote.clientNom}</p>
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
        {t.totalTTC} : {quote.totalTTC.toLocaleString('fr-FR')} FCFA
      </p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>
        {t.trackingCode} : <strong style={{ color: 'var(--text)', letterSpacing: '0.05em' }}>{quote.accessCode}</strong>
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onView} className="btn-primary btn-sm" style={{ fontSize: '0.75rem', padding: '0.45rem 0.9rem' }}>
          {t.viewPrintQuote}
        </button>
        {callHref && (
          <a href={callHref} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            {t.requestCall}
          </a>
        )}
      </div>
    </div>
  )
}

function HumanHelpForm({ onSubmit, t }: { onSubmit: (fields: { clientNom: string; clientEmail: string; clientTelephone: string }) => void; t: Dictionary['chat'] }) {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nom.trim() || !email.trim() || submitting) return
    setSubmitting(true)
    onSubmit({ clientNom: nom.trim(), clientEmail: email.trim(), clientTelephone: tel.trim() })
  }

  return (
    <div
      className="rounded-xl p-3.5"
      style={{ maxWidth: '85%', background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}
    >
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text)' }}>{t.humanHelpTitle}</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder={t.humanHelpNamePlaceholder}
          required
          disabled={submitting}
          className="input text-sm w-full"
          autoComplete="name"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.humanHelpEmailPlaceholder}
          required
          disabled={submitting}
          className="input text-sm w-full"
          autoComplete="email"
        />
        <input
          type="tel"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          placeholder={t.humanHelpPhonePlaceholder}
          disabled={submitting}
          className="input text-sm w-full"
          autoComplete="tel"
        />
        <button type="submit" disabled={submitting || !nom.trim() || !email.trim()} className="btn-primary btn-sm w-full" style={{ fontSize: '0.75rem' }}>
          {submitting ? t.requestingHuman : t.humanHelpSubmit}
        </button>
      </form>
    </div>
  )
}

export default function ChatWidget() {
  const pathname = usePathname()
  const { data: { personal } } = usePortfolio()
  const locale = useLocale()
  const t = useDictionary()
  const suggestions = personal.cvUrl ? [...t.chat.suggestions, t.chat.cvSuggestion] : t.chat.suggestions
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status, addToolOutput } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat', body: { locale } }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  const busy = status === 'submitted' || status === 'streaming'
  const [justOpened, setJustOpened] = useState(false)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250)
  }, [open])

  useEffect(() => {
    if (!justOpened) return
    const t = setTimeout(() => setJustOpened(false), 1500)
    return () => clearTimeout(t)
  }, [justOpened])

  // Lets other pages (e.g. the Offers page's "Request a quote" buttons) open
  // the widget and start the conversation without lifting chat state up.
  useEffect(() => {
    return onOpenChatRequest((text) => {
      setOpen(true)
      setJustOpened(true)
      sendMessage({ text })
    })
  }, [sendMessage])

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v
      if (next) setJustOpened(true)
      return next
    })
  }

  const headerMood: BotMood = busy ? 'thinking' : justOpened ? 'happy' : 'idle'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    sendMessage({ text })
    setInput('')
  }

  const quickSend = (text: string) => {
    if (busy) return
    sendMessage({ text })
  }

  if (pathname?.startsWith('/admin')) return null

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        onClick={toggleOpen}
        aria-label={open ? t.chat.toggleClose : t.chat.toggleOpen}
        aria-expanded={open}
        aria-controls="chat-widget-panel"
        className="fixed bottom-5 right-5 z-40 flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          background: 'var(--accent)',
          boxShadow: '0 8px 30px var(--accent-glow)',
          color: 'var(--accent-contrast)',
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.svg
              key="close"
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={{ duration: 0.15 }}
              width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </motion.svg>
          ) : (
            <motion.div
              key="bot"
              initial={{ opacity: 0, rotate: 45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -45 }}
              transition={{ duration: 0.15 }}
            >
              <BotIcon width={26} height={26} aria-hidden="true" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="chat-widget-panel"
            role="dialog"
            aria-label={t.chat.panelAria}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed z-40 flex flex-col overflow-hidden"
            style={{
              bottom: 'calc(5rem + 1rem)',
              right: '1.25rem',
              width: 'min(380px, calc(100vw - 2.5rem))',
              height: 'min(560px, calc(100vh - 8rem))',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '1.25rem',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent-gradient)' }}
                aria-hidden="true"
              >
                <BotIcon width={17} height={17} color="white" mood={headerMood} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                  {t.chat.headerTitle}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  {t.chat.headerSubtitle}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-end gap-2">
                    <BotAvatar mood="happy" />
                    <div
                      className="rounded-xl px-3.5 py-3 text-sm leading-relaxed"
                      style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)', maxWidth: '85%' }}
                    >
                      {t.chat.greeting} <strong style={{ color: 'var(--text)' }}>{t.chat.greetingBold}</strong> {t.chat.greetingEnd}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(({ label, text }) => (
                      <button
                        key={label}
                        onClick={() => quickSend(text)}
                        className="text-xs font-medium rounded-full transition-colors"
                        style={{
                          background: 'var(--accent-glow)',
                          color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                          padding: '0.45rem 0.9rem',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message) => {
                const isUser = message.role === 'user'
                return (
                  <div key={message.id} className="space-y-2">
                    {message.parts.map((part, i) => {
                      if (part.type === 'text') {
                        if (isUser) {
                          return (
                            <div key={i} className="flex" style={{ justifyContent: 'flex-end' }}>
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                                style={{ maxWidth: '85%', background: 'var(--accent-glow)', border: '1px solid transparent', color: 'var(--text)' }}
                              >
                                <span style={{ whiteSpace: 'pre-wrap' }}>{part.text}</span>
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                            <BotAvatar mood={moodForText(part.text)} />
                            <div
                              className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                              style={{ maxWidth: '78%', minWidth: 0, overflowX: 'hidden', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                            >
                              <ChatMarkdown text={part.text} />
                            </div>
                          </div>
                        )
                      }

                      if (part.type === 'tool-generateQuote') {
                        if (part.state === 'output-available') {
                          const quote = part.output as Quote
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="excited" />
                              <QuoteCard quote={quote} onView={() => setViewingQuote(quote)} adminEmail={personal.email} t={t.chat} />
                            </div>
                          )
                        }
                        if (part.state === 'input-streaming' || part.state === 'input-available') {
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="thinking" />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-xs italic"
                                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
                              >
                                {t.chat.generatingQuote}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }

                      if (part.type === 'tool-lookupQuote') {
                        if (part.state === 'output-available') {
                          const output = part.output as Quote | { error: string }
                          if ('error' in output) {
                            return (
                              <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                                <BotAvatar mood="confused" />
                                <div
                                  className="rounded-xl px-3.5 py-2.5 text-sm"
                                  style={{ maxWidth: '78%', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                                >
                                  {output.error}
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="happy" />
                              <QuoteCard quote={output} onView={() => setViewingQuote(output)} adminEmail={personal.email} t={t.chat} />
                            </div>
                          )
                        }
                        if (part.state === 'input-streaming' || part.state === 'input-available') {
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="thinking" />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-xs italic"
                                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
                              >
                                {t.chat.searchingQuote}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }

                      if (part.type === 'tool-sendQuoteEmail') {
                        if (part.state === 'output-available') {
                          const output = part.output as { ok: boolean; message: string }
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood={output.ok ? 'excited' : 'confused'} />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-sm"
                                style={{ maxWidth: '78%', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                              >
                                {output.message}
                              </div>
                            </div>
                          )
                        }
                        if (part.state === 'input-streaming' || part.state === 'input-available') {
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="thinking" />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-xs italic"
                                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
                              >
                                {t.chat.sendingEmail}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }

                      if (part.type === 'tool-checkAvailability') {
                        if (part.state === 'output-available') {
                          const output = part.output as { date: string; slots: string[] } | { days: { date: string; slots: string[] }[] }
                          const rows = 'days' in output ? output.days : [{ date: output.date, slots: output.slots }]
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="happy" />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-xs space-y-1.5"
                                style={{ maxWidth: '78%', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                              >
                                {rows.length === 0 || rows.every((r) => r.slots.length === 0) ? (
                                  <span style={{ color: 'var(--text-subtle)' }}>{t.chat.noAvailability}</span>
                                ) : rows.map((r) => (
                                  <p key={r.date}>
                                    <strong>{new Date(`${r.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                                    {' — '}{r.slots.slice(0, 6).join(', ')}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        if (part.state === 'input-streaming' || part.state === 'input-available') {
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="thinking" />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-xs italic"
                                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
                              >
                                {t.chat.checkingAvailability}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }

                      if (part.type === 'tool-bookMeeting' || part.type === 'tool-lookupBooking') {
                        if (part.state === 'output-available') {
                          const output = part.output as Booking | { error: string }
                          if ('error' in output) {
                            return (
                              <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                                <BotAvatar mood="confused" />
                                <div
                                  className="rounded-xl px-3.5 py-2.5 text-sm"
                                  style={{ maxWidth: '78%', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                                >
                                  {output.error}
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="excited" />
                              <BookingCard booking={output} t={t.chat} />
                            </div>
                          )
                        }
                        if (part.state === 'input-streaming' || part.state === 'input-available') {
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="thinking" />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-xs italic"
                                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
                              >
                                {part.type === 'tool-bookMeeting' ? t.chat.bookingMeeting : t.chat.searchingBooking}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }

                      if (part.type === 'tool-cancelBooking') {
                        if (part.state === 'output-available') {
                          const output = part.output as { ok: boolean; message: string }
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood={output.ok ? 'happy' : 'confused'} />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-sm"
                                style={{ maxWidth: '78%', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                              >
                                {output.message}
                              </div>
                            </div>
                          )
                        }
                        if (part.state === 'input-streaming' || part.state === 'input-available') {
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="thinking" />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-xs italic"
                                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
                              >
                                {t.chat.cancelingBooking}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }

                      if (part.type === 'tool-joinWaitlist') {
                        if (part.state === 'output-available') {
                          const output = part.output as { ok: boolean; message: string }
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood={output.ok ? 'happy' : 'confused'} />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-sm"
                                style={{ maxWidth: '78%', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                              >
                                {output.message}
                              </div>
                            </div>
                          )
                        }
                        if (part.state === 'input-streaming' || part.state === 'input-available') {
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="thinking" />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-xs italic"
                                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
                              >
                                {t.chat.joiningWaitlist}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }

                      if (part.type === 'tool-requestHumanHelp') {
                        if (part.state === 'output-available') {
                          const output = part.output as { ok: boolean; message: string }
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood={output.ok ? 'happy' : 'confused'} />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-sm"
                                style={{ maxWidth: '78%', background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--text)' }}
                              >
                                {output.message}
                              </div>
                            </div>
                          )
                        }
                        if (part.state === 'input-available') {
                          const reason = (part.input as { reason: string }).reason
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="idle" />
                              <HumanHelpForm
                                t={t.chat}
                                onSubmit={async (fields) => {
                                  const output = await requestHumanHelp({ reason, ...fields })
                                  addToolOutput({ tool: 'requestHumanHelp', toolCallId: part.toolCallId, output })
                                }}
                              />
                            </div>
                          )
                        }
                        if (part.state === 'input-streaming') {
                          return (
                            <div key={i} className="flex items-end gap-2" style={{ justifyContent: 'flex-start' }}>
                              <BotAvatar mood="thinking" />
                              <div
                                className="rounded-xl px-3.5 py-2.5 text-xs italic"
                                style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
                              >
                                {t.chat.requestingHuman}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }

                      return null
                    })}
                  </div>
                )
              })}
              {busy && (
                <div className="flex" style={{ justifyContent: 'flex-start' }}>
                  <motion.div
                    className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                    style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
                    aria-label={t.chat.thinkingAria}
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <BotAvatar mood="thinking" />
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{t.chat.thinking}</span>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="rounded-full"
                          style={{ width: 4, height: 4, background: 'var(--text-subtle)' }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.chat.placeholder}
                aria-label={t.chat.inputAria}
                className="input text-sm flex-1"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label={t.chat.sendAria}
                className="btn-primary btn-sm shrink-0"
                style={{ padding: '0.6rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {viewingQuote && <QuoteView quote={viewingQuote} onClose={() => setViewingQuote(null)} />}
    </>
  )
}
