'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai'
import { m, AnimatePresence } from 'framer-motion'
import type { Quote } from '@/actions/quotes'
import type { Booking } from '@/actions/bookings'
import { requestHumanHelp } from '@/actions/escalation'
import { usePortfolio } from '@/providers/portfolio-core'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { onOpenChatRequest } from '@/lib/chat-bridge'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { BotIcon, BotAvatar, type BotMood } from './BotIcon'

// Only needed once a visitor actually opens a generated devis (QR code lib
// included) — keep it split out of the widget's own chunk until then.
const QuoteView = dynamic(() => import('./QuoteView'), { ssr: false })

// react-markdown + remark-gfm — only needed once an actual bot message
// needs rendering, not the instant the (closed) chat bubble mounts.
const ChatMarkdown = dynamic(() => import('./ChatMarkdown'), { ssr: false })


function moodForText(text: string): BotMood {
  const t = text.toLowerCase()
  if (/d[ée]sol[ée]|je n(?:'| )ai pas|aucune information|je ne sais pas|malheureusement|je ne peux pas|sorry|i don't have|i don't know|unfortunately|i can't/.test(t)) return 'confused'
  if (/devis|quote|f[ée]licitations|congratulations|g[ée]n[ée]r[ée] avec succ[eè]s|generated successfully|c'est parti|let's go|excellente nouvelle|great news/.test(t)) return 'excited'
  if (/bonjour|hello|hi there|bienvenue|welcome|ravi|glad|super|great|avec plaisir|with pleasure|content de|happy to/.test(t)) return 'happy'
  return 'idle'
}

type ChatCategory = 'profile' | 'projects' | 'services' | 'quote' | 'technical' | 'contact' | 'content' | 'general'

// Classifies the VISITOR'S own outgoing message (mirrors moodForText above,
// which classifies the bot's replies) to pick a contextual "processing"
// message the instant the message is sent — before any server response, so
// it adds no latency and needs no extra model call. Order matters: more
// specific patterns (quote, contact) are checked before the broader
// services/pricing one, since "combien ça coûte" alone is ambiguous between
// the two. Falls back to 'general' whenever nothing matches confidently —
// this function only ever picks the *initial* status text; once a real tool
// call or streamed text becomes visible, that takes over (see ChatWidget).
//
// Eight buckets, not sixteen: the system prompt (api/chat/route.ts) answers
// most of the finer-grained topics a visitor might ask about (tech stack,
// AI/automation, databases, feasibility, timelines…) from the very same
// context blocks (projects, skills, offers, work framework) — there is no
// separate tool or data source behind them, so detecting them as distinct
// categories would just be guessing at a distinction the backend itself
// doesn't make. Each bucket's message copy is written broadly enough to
// cover every topic grouped into it instead.
function categorizeMessage(text: string): ChatCategory {
  const t = text.toLowerCase()
  if (/devis|quote|chiffrage|obtenir un devis|get a quote|combien .*(co[uû]te|facture)|price estimate|j'ai (un|une) (projet|id[ée]e)|i have a project|j'aimerais r[ée]aliser|i'd like to build/.test(t)) return 'quote'
  if (/contact|rendez-vous|rdv|appel|appeler|call|joindre|rencontrer|disponibilit[ée]|meeting|schedule|book a/.test(t)) return 'contact'
  if (/projet|portfolio.*(r[ée]alis|travaux)|project|r[ée]alisation/.test(t)) return 'projects'
  if (/comp[ée]tence|technologie|stack|parcours|exp[ée]rience|formation|cv\b|skill|background|resume\b/.test(t)) return 'profile'
  if (/document|guide|rapport|ebook|article|blog|ressource|resource/.test(t)) return 'content'
  if (/service|offre|tarif|prix|budget|co[uû]te|cost|pricing|offer|intelligence artificielle|\bia\b|automatisation|automation|d[ée]lai|deadline/.test(t)) return 'services'
  if (/architecture|base de donn[ée]es|database|possible de|faisabilit[ée]|feasib|techniquement|technically|comment [çc]a marche|how does it work/.test(t)) return 'technical'
  return 'general'
}

// 'general' reuses the existing `thinking` key as its fallback text. A
// switch (not a keyed lookup into Dictionary['chat']) because that object
// also holds non-string entries (suggestions, cvSuggestion), which a plain
// `Record<ChatCategory, keyof Dictionary['chat']>` can't exclude.
//
// `altB` alternates which of a category's two phrasings shows (true on
// every other send) — enough variety that the same wording doesn't repeat
// on back-to-back messages, without re-picking mid-stream (it's read once,
// at send time, same as the category itself).
function categoryMessage(category: ChatCategory, t: Dictionary['chat'], altB: boolean): string {
  switch (category) {
    case 'profile': return altB ? t.thinkingProfileB : t.thinkingProfileA
    case 'projects': return altB ? t.thinkingProjectsB : t.thinkingProjectsA
    case 'services': return altB ? t.thinkingServicesB : t.thinkingServicesA
    case 'quote': return altB ? t.thinkingQuoteB : t.thinkingQuoteA
    case 'technical': return altB ? t.thinkingTechnicalB : t.thinkingTechnicalA
    case 'contact': return t.thinkingContact
    case 'content': return t.thinkingContent
    default: return altB ? t.thinkingGeneralB : t.thinkingGeneralA
  }
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
        <p className="text-xs font-semibold mb-1" style={{ color: '#D90000' }}>{t.bookingCancelled}</p>
      )}
      <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>{booking.clientNom}</p>
      <p className="text-xs mb-2" style={{ color: 'var(--text-subtle)' }}>
        {t.trackingCode} : <strong style={{ color: 'var(--text)', letterSpacing: '0.05em' }}>{booking.accessCode}</strong>
      </p>
      {booking.status !== 'cancelled' && (
        <a
          href={booking.meetingUrl} target="_blank" rel="noopener noreferrer"
          className="btn-primary btn-sm"
          style={{ fontSize: '0.75rem', padding: '0.45rem 0.9rem' }}
        >
          {t.joinMeeting}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      )}
    </div>
  )
}

function QuoteCard({ quote, onView, adminEmail, t }: { quote: Quote; onView: () => void; adminEmail?: string; t: Dictionary['chat'] }) {
  const locale = useLocale()
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
        {quote.signToken && (
          <a
            href={`/${locale}/devis/signature/${quote.signToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.45rem 0.9rem' }}
          >
            {t.signOnline}
          </a>
        )}
        {callHref && (
          <a href={callHref} className="btn-secondary btn-sm" style={{ fontSize: '0.75rem', padding: '0.45rem 0.9rem' }}>
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

interface ChatWidgetProps {
  // Set by ChatWidgetLoader when the visitor's own click is what triggered
  // this chunk to load — the panel must open as if the real button had been
  // there all along, not merely appear.
  autoOpen?: boolean
  // A message dispatched through the chat bridge (e.g. "Request a quote" on
  // the Offers page) *before* this component existed to listen for it. The
  // loader captures it and replays it here exactly once.
  initialMessage?: string | null
}

// Messages carry no timestamp of their own. Each bubble renders one of these,
// which stamps the moment it first mounts — the moment the message appeared —
// and never changes afterwards (a lazy state initializer runs once), without
// any effect or per-render clock read.
function MessageTime({ locale }: { locale: string }) {
  const [stamp] = useState(() => Date.now())
  const label = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }).format(stamp)
  return <>{label}</>
}

// The conversation survives a page reload for a day (browser storage only);
// the same anonymous id lets the server keep one transcript per conversation.
const STORAGE_KEY = 'ns-chat-v1'
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000
const STORAGE_MAX_CHARS = 300_000

interface StoredChat { id: string; savedAt: number; messages: UIMessage[] }

function readStoredChat(): StoredChat | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredChat
    if (typeof parsed.id !== 'string' || !Array.isArray(parsed.messages) || Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredChat(chat: StoredChat | null) {
  try {
    if (!chat || chat.messages.length === 0) { window.localStorage.removeItem(STORAGE_KEY); return }
    const raw = JSON.stringify(chat)
    if (raw.length <= STORAGE_MAX_CHARS) window.localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    // Storage unavailable or full: the chat simply won't survive a reload.
  }
}

// Read by the transport at send time (a module variable rather than a ref: the
// transport is built during render).
let currentConversationId = ''

const newConversationId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`)

export default function ChatWidget({ autoOpen = false, initialMessage = null }: ChatWidgetProps) {
  const pathname = usePathname()
  const { data: { personal } } = usePortfolio()
  const locale = useLocale()
  const t = useDictionary()
  const suggestions = personal.cvUrl ? [...t.chat.suggestions, t.chat.cvSuggestion] : t.chat.suggestions
  const [open, setOpen] = useState(autoOpen)
  const [input, setInput] = useState('')
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const restored = useRef(false)

  const { messages, sendMessage, setMessages, status, addToolOutput, error, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat', body: () => ({ locale, conversationId: currentConversationId }) }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  // Classified the instant a message is sent (see categorizeMessage) so the
  // "processing" bubble can be contextual from the very first frame, with no
  // extra latency. Only one exchange is ever in flight at a time in this UI
  // (every send path below checks `busy` first), so a single piece of state
  // can never leak a stale category onto a later, different request.
  const [pendingCategory, setPendingCategory] = useState<ChatCategory>('general')
  // Alternates which of a category's two phrasings categoryMessage renders
  // (see its comment) — the counter only needs to be written from the event
  // handler below, never read during render, so it stays a ref; the boolean
  // derived from it is what actually drives rendering.
  const [altVariant, setAltVariant] = useState(false)
  const sendCount = useRef(0)
  const dispatch = useCallback((text: string) => {
    setPendingCategory(categorizeMessage(text))
    sendCount.current += 1
    setAltVariant(sendCount.current % 2 === 0)
    sendMessage({ text })
  }, [sendMessage])

  // Resume the conversation of the last 24 h, if any (runs once, after mount).
  useEffect(() => {
    const stored = readStoredChat()
    currentConversationId = stored?.id ?? newConversationId()
    if (stored && stored.messages.length > 0) setMessages(stored.messages)
    restored.current = true
  }, [setMessages])

  // Save it whenever an exchange has completed.
  useEffect(() => {
    if (!restored.current || status !== 'ready') return
    writeStoredChat({ id: currentConversationId, savedAt: Date.now(), messages })
  }, [messages, status])

  const busy = status === 'submitted' || status === 'streaming'
  // True once the in-progress assistant message has any part to show —
  // streamed text or a tool call's own bubble — at which point that *is*
  // the status indicator and the generic category bubble should step aside.
  const lastMessage = messages[messages.length - 1]
  const lastMessageHasVisibleParts = lastMessage?.role === 'assistant' && lastMessage.parts.length > 0
  const [justOpened, setJustOpened] = useState(autoOpen)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250)
  }, [open])

  // Escape closes the panel — but not while the quote overlay on top of it is
  // showing, which handles its own Escape.
  useEscapeKey(open && !viewingQuote, useCallback(() => setOpen(false), []))

  useEffect(() => {
    if (!justOpened) return
    const t = setTimeout(() => setJustOpened(false), 1500)
    return () => clearTimeout(t)
  }, [justOpened])

  // Replays a bridge message that fired before this chunk finished loading.
  // Guarded by a ref rather than the dependency list so a re-render can never
  // send it twice.
  const replayedInitial = useRef(false)
  useEffect(() => {
    if (!initialMessage || replayedInitial.current) return
    replayedInitial.current = true
    setOpen(true)
    setJustOpened(true)
    dispatch(initialMessage)
  }, [initialMessage, dispatch])

  // Lets other pages (e.g. the Offers page's "Request a quote" buttons) open
  // the widget and start the conversation without lifting chat state up.
  useEffect(() => {
    return onOpenChatRequest((text) => {
      setOpen(true)
      setJustOpened(true)
      dispatch(text)
    })
  }, [dispatch])

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v
      if (next) setJustOpened(true)
      return next
    })
  }

  const handleClear = () => {
    setMessages([])
    writeStoredChat(null)
    currentConversationId = newConversationId()
  }

  const headerMood: BotMood = busy ? 'thinking' : justOpened ? 'happy' : 'idle'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    dispatch(text)
    setInput('')
  }

  const quickSend = (text: string) => {
    if (busy) return
    dispatch(text)
  }

  if (pathname?.startsWith('/admin')) return null

  return (
    <>
      {/* Floating toggle button */}
      <m.button
        onClick={toggleOpen}
        aria-label={open ? t.chat.toggleClose : t.chat.toggleOpen}
        aria-expanded={open}
        aria-controls="chat-widget-panel"
        className="fixed right-5 z-40 flex items-center justify-center"
        style={{
          // Clear the iPhone home indicator when installed to the home screen.
          bottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
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
            <m.svg
              key="close"
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={{ duration: 0.15 }}
              width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </m.svg>
          ) : (
            <m.div
              key="bot"
              initial={{ opacity: 0, rotate: 45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -45 }}
              transition={{ duration: 0.15 }}
            >
              <BotIcon width={26} height={26} aria-hidden="true" />
            </m.div>
          )}
        </AnimatePresence>
      </m.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <m.div
            id="chat-widget-panel"
            role="dialog"
            aria-modal="false"
            aria-label={t.chat.panelAria}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed z-40 flex flex-col overflow-hidden"
            style={{
              bottom: 'calc(5rem + 1rem + env(safe-area-inset-bottom))',
              right: '1.25rem',
              width: 'min(380px, calc(100vw - 2.5rem))',
              // dvh tracks the *visible* viewport, so the panel shrinks with
              // mobile Safari's toolbar and with the soft keyboard instead of
              // pushing its own input field off-screen.
              height: 'min(560px, calc(100dvh - 8rem))',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent-gradient)' }}
                aria-hidden="true"
              >
                <BotIcon width={17} height={17} color="white" mood={headerMood} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                  {t.chat.headerTitle}
                </p>
                <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  <span className="flex-shrink-0" style={{ width: 6, height: 6, background: '#22c55e' }} aria-hidden="true" />
                  {t.chat.headerStatus}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <m.button
                  type="button"
                  onClick={handleClear}
                  disabled={messages.length === 0}
                  aria-label={t.chat.clearChat}
                  title={t.chat.clearChat}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: 'var(--text-subtle)' }}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </m.button>
                <m.button
                  type="button"
                  onClick={toggleOpen}
                  aria-label={t.chat.toggleClose}
                  title={t.chat.toggleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-subtle)' }}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </m.button>
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
                  <p className="text-[11px] leading-snug px-1" style={{ color: 'var(--text-subtle)' }}>
                    {t.chat.privacyNote}{' '}
                    <a href={`/${locale}/confidentialite`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>{t.chat.privacyLink}</a>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(({ label, text }) => (
                      <m.button
                        key={label}
                        onClick={() => quickSend(text)}
                        className="text-xs font-medium"
                        style={{
                          background: 'var(--accent-glow)',
                          color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                          padding: '0.45rem 0.9rem',
                        }}
                        whileHover={{ scale: 1.05, opacity: 0.8 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                      >
                        {label}
                      </m.button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message) => {
                const isUser = message.role === 'user'
                return (
                  <div key={message.id} className="space-y-1">
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
                    <p
                      className="text-[10px]"
                      style={{
                        color: 'var(--text-subtle)',
                        textAlign: isUser ? 'right' : 'left',
                        paddingLeft: isUser ? 0 : 32,
                        paddingRight: isUser ? 2 : 0,
                      }}
                    >
                      <MessageTime locale={locale} />
                    </p>
                  </div>
                )
              })}
              {/* Only shown while nothing more specific is visible yet — the
                  instant a tool call or streamed text appears in the last
                  message's own parts (rendered above), that already is the
                  status indicator, and stacking this under it would just be
                  a second, redundant "thinking" bubble. */}
              {busy && !lastMessageHasVisibleParts && (
                <div className="flex" style={{ justifyContent: 'flex-start' }}>
                  <m.div
                    className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                    style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
                    role="status"
                    aria-label={t.chat.thinkingAria}
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <BotAvatar mood="thinking" />
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{categoryMessage(pendingCategory, t.chat, altVariant)}</span>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <m.span
                          key={i}
                          className="rounded-full"
                          style={{ width: 4, height: 4, background: 'var(--text-subtle)' }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </m.div>
                </div>
              )}
              {error && (
                <div className="flex" style={{ justifyContent: 'flex-start' }}>
                  <div className="flex items-end gap-2">
                    <BotAvatar mood="confused" />
                    <div
                      role="status"
                      className="rounded-xl px-3.5 py-2.5 text-sm flex items-center gap-3 flex-wrap"
                      style={{ maxWidth: '85%', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    >
                      <span>{t.chat.errorMessage}</span>
                      <button
                        type="button"
                        onClick={() => regenerate()}
                        className="btn-secondary btn-sm shrink-0"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                      >
                        {t.chat.retry}
                      </button>
                    </div>
                  </div>
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
          </m.div>
        )}
      </AnimatePresence>

      {viewingQuote && <QuoteView quote={viewingQuote} onClose={() => setViewingQuote(null)} />}
    </>
  )
}
