'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import ChatMarkdown from '@/components/chat/ChatMarkdown'
import { BotIcon } from '@/components/chat/BotIcon'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, RefreshIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { useToast } from '@/components/admin/Toast'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { usePortfolio } from '@/providers/PortfolioContext'
import { SLASH_COMMANDS, START_CARDS, commandByName, matchCommands, type SlashCommand } from '@/lib/assistant/commands'
import { contextForKey, type ContextChip } from '@/lib/assistant/page-context'
import { appendDictation, transcriptOf } from '@/lib/assistant/dictation'

// The browser's speech recognition (Chrome, Edge, Safari): absent elsewhere, then no microphone button.
interface SpeechLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}
type SpeechCtor = new () => SpeechLike
const speechCtor = (): SpeechCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const TOOL_LABELS: Record<string, string> = {
  getProfile: 'Lecture du profil', listProjects: 'Liste des projets', getProject: 'Lecture d’un projet', listBlogPosts: 'Liste des articles',
  getBlogPost: 'Lecture d’un article', getSkills: 'Lecture des compétences', listExperiences: 'Lecture des expériences', listOffers: 'Lecture des offres',
  auditPortfolio: 'Audit du portfolio', getSiteStats: 'Statistiques d’audience', getBusinessOverview: 'Synthèse d’activité', checkSlug: 'Vérification du slug',
  getDailyBriefing: 'Briefing du jour', listDocuments: 'Liste des documents', analyzeDocument: 'Lecture d’un document',
  analyzeChatLogs: 'Analyse des conversations du chatbot', listMyDrafts: 'Liste des brouillons', draftBlogPost: 'Rédaction d’un article (FR + EN)',
  draftFieldPatch: 'Réécriture d’un champ', reviseDraft: 'Révision d’un brouillon',
  listPendingQuotes: 'Devis en attente de réponse', draftQuoteReminder: 'Brouillon de relance de devis',
}

interface ToolPartLike { type: string; state?: string; input?: unknown; output?: unknown }

function shortJson(value: unknown): string {
  if (value === undefined || value === null) return ''
  try {
    const text = JSON.stringify(value, null, 1)
    return text.length > 420 ? `${text.slice(0, 420)}…` : text
  } catch {
    return ''
  }
}

// One line per tool call, expandable to what was asked. Failures stay visible.
function ToolTrace({ part, onOpenDraft }: { part: ToolPartLike; onOpenDraft: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const name = part.type.slice(5)
  const out = part.output as { error?: string; draftId?: string } | undefined
  const failed = part.state === 'output-error' || Boolean(out && typeof out === 'object' && out.error)
  const done = part.state === 'output-available'
  const draftId = done && out && typeof out === 'object' ? out.draftId : undefined
  const details = shortJson(part.input)
  return (
    <div className="my-1.5 text-xs" style={{ border: `1px solid ${failed ? '#D90000' : 'var(--border)'}`, background: 'var(--surface)', fontFamily: 'var(--font-poppins)' }}>
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-1.5">
        <span className="w-2 h-2 flex-shrink-0" aria-hidden="true" style={{ background: failed ? '#D90000' : done ? '#15803D' : 'var(--text-subtle)' }} />
        <span className="flex-1 min-w-0" style={{ color: failed ? '#D90000' : 'var(--text-muted)' }}>
          {TOOL_LABELS[name] ?? name}{failed && out?.error ? ` — ${out.error}` : ''}{!done && !failed ? '…' : ''}
        </span>
        {draftId && <button type="button" className="btn-secondary btn-xs" onClick={() => onOpenDraft(draftId)}>Ouvrir le brouillon</button>}
        {details && (
          <button type="button" aria-expanded={open} aria-label={`Détails : ${TOOL_LABELS[name] ?? name}`} onClick={() => setOpen((v) => !v)} className="px-1.5" style={{ color: 'var(--text-subtle)' }}>
            {open ? '▴' : '▾'}
          </button>
        )}
      </div>
      {open && details && (
        <pre className="px-2.5 py-2 overflow-x-auto" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11 }}>{details}</pre>
      )}
    </div>
  )
}

function textOf(message: UIMessage): string {
  return message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('').trim()
}

function Message({ message, last, busy, onOpenDraft, onRegenerate }: { message: UIMessage; last: boolean; busy: boolean; onOpenDraft: (id: string) => void; onRegenerate: () => void }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="text-sm px-4 py-2.5 max-w-[85%]" style={{ background: 'var(--surface-hover)', color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'var(--font-poppins)' }}>{textOf(message)}</p>
      </div>
    )
  }
  const answer = textOf(message)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer)
      toast('Réponse copiée ✓')
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('Copie impossible : sélectionne le texte à la main.', 'error')
    }
  }
  return (
    <div className="flex gap-3">
      <span className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }} aria-hidden="true">
        <BotIcon width={17} height={17} />
      </span>
      <div className="min-w-0 flex-1 text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
        {message.parts.map((part, i) => {
          if (part.type === 'text') return <ChatMarkdown key={i} text={part.text} safeImages />
          if (part.type.startsWith('tool-')) return <ToolTrace key={i} part={part as ToolPartLike} onOpenDraft={onOpenDraft} />
          return null
        })}
        {answer && !(last && busy) && (
          <div className="mt-1.5 flex gap-1.5">
            <button type="button" className="btn-secondary btn-xs inline-flex items-center justify-center" style={{ width: 30, height: 28, padding: 0 }} onClick={copy} aria-label="Copier la réponse" title="Copier la réponse" data-testid="copy-answer">
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {last && (
              <button type="button" className="btn-secondary btn-xs inline-flex items-center justify-center" style={{ width: 30, height: 28, padding: 0 }} onClick={onRegenerate} aria-label="Régénérer la réponse" title="Régénérer la réponse (compte pour une requête du quota gratuit)" data-testid="regenerate-answer">
                <HugeiconsIcon icon={RefreshIcon} size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  conversationId: string
  initialMessages: UIMessage[]
  variant: 'page' | 'popover'
  /** The assistant is paused (free quota reached, disabled…): the composer says so and sends nothing. */
  blocked: boolean
  /** One line from the daily briefing, shown under the greeting. */
  briefingSummary?: string | null
  /** A question to put in the message box (from the command palette). Never sent for the admin. */
  prefill?: { text: string; nonce: number } | null
  /** Key of the back-office page the admin is on (see lib/assistant/page-context.ts). */
  contextKey?: string | null
  onTurnFinished: () => void
  onOpenDraft: (id: string) => void
}

// One conversation, in the style of a modern chat app: a greeting, four entry cards
// and a composer while it is empty (typing "/" opens ready-made commands), then the
// messages with the composer pinned below.
export default function ChatPane({ conversationId, initialMessages, variant, blocked, briefingSummary, contextKey, prefill, onTurnFinished, onOpenDraft }: Props) {
  const popover = variant === 'popover'
  const { data: { personal } } = usePortfolio()
  const firstName = (personal?.name ?? '').trim().split(/\s+/)[0] ?? ''
  const context = contextForKey(contextKey)
  const [input, setInput] = useState('')
  const [menu, setMenu] = useState(false)
  const [active, setActive] = useState(0)
  const [canDictate, setCanDictate] = useState(false)
  const [listening, setListening] = useState(false)
  const recognition = useRef<SpeechLike | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/admin-assistant', body: { conversationId } }), [conversationId])
  // The page can change while the conversation goes on (the popover follows the admin
  // around), so its key travels with each request instead of living in the transport.
  const requestOptions = { body: { pageKey: context?.key ?? null } }
  const { messages, sendMessage, regenerate, status, stop, error, clearError } = useChat({ id: conversationId, messages: initialMessages, transport })
  const busy = status === 'submitted' || status === 'streaming'
  const empty = messages.length === 0

  const wasBusy = useRef(false)
  useEffect(() => {
    if (busy) { wasBusy.current = true; return }
    if (wasBusy.current) { wasBusy.current = false; onTurnFinished() }
  }, [busy, onTurnFinished])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, status])

  useEffect(() => {
    if (speechCtor()) Promise.resolve().then(() => setCanDictate(true))
    return () => recognition.current?.stop()
  }, [])

  const closeMenu = useCallback(() => setMenu(false), [])
  useEscapeKey(menu, closeMenu)

  const slashMatches = useMemo(() => matchCommands(input), [input])
  const slashOpen = slashMatches.length > 0 && !busy && !blocked
  const activeIndex = Math.min(active, Math.max(0, slashMatches.length - 1))

  const grow = () => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  // One sentence at a time: the words land in the message box, to be read and sent by the admin.
  const toggleDictation = () => {
    if (listening) { recognition.current?.stop(); return }
    const Ctor = speechCtor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = 'fr-FR'
    r.interimResults = false
    r.continuous = false
    r.onresult = (e) => { setInput((prev) => appendDictation(prev, transcriptOf(e.results))); requestAnimationFrame(grow) }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recognition.current = r
    setListening(true)
    r.start()
  }

  const send = (text: string) => {
    const value = text.trim()
    if (!value || busy || blocked) return
    clearError()
    setMenu(false)
    sendMessage({ text: value }, requestOptions)
    setInput('')
    requestAnimationFrame(grow)
  }

  const fill = (text: string) => {
    setInput(text)
    setMenu(false)
    requestAnimationFrame(() => {
      grow()
      const el = areaRef.current
      if (el) { el.focus(); el.setSelectionRange(text.length, text.length) }
    })
  }

  useEffect(() => {
    if (!prefill) return
    const id = requestAnimationFrame(() => fill(prefill.text))
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fill only touches this component's own state
  }, [prefill])

  const run = (c: Pick<SlashCommand, 'mode' | 'prompt'> | ContextChip) => ((c.mode ?? 'send') === 'send' ? send(c.prompt) : fill(c.prompt))

  const composer = (
    <div className="w-full">
      <form
        className="relative flex items-end gap-1.5 px-2.5 py-2"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 2px 14px rgba(0,0,0,0.08)' }}
        onSubmit={(e) => { e.preventDefault(); send(input) }}
      >
        {(menu || slashOpen) && (
          <div className="absolute bottom-full left-0 mb-2 w-80 max-w-[90vw] p-1 z-10 max-h-72 overflow-y-auto" role="menu" aria-label="Commandes" style={{ background: 'var(--surface)', border: '1px solid var(--brand)', boxShadow: '4px 4px 0 var(--brand)' }}>
            {(slashOpen ? slashMatches : SLASH_COMMANDS).map((c, i) => {
              const on = slashOpen && i === activeIndex
              return (
                <button
                  key={c.name} type="button" role="menuitem"
                  className="w-full text-left px-3 py-2 transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ background: on ? 'var(--accent)' : undefined, color: on ? 'var(--accent-contrast)' : 'var(--text)', fontFamily: 'var(--font-poppins)' }}
                  onMouseEnter={() => slashOpen && setActive(i)}
                  onClick={() => run(c)}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-display font-semibold text-xs">/{c.name}</span>
                    <span className="text-sm">{c.label}</span>
                  </span>
                  <span className="block text-xs" style={{ opacity: 0.7 }}>{c.description}</span>
                </button>
              )
            })}
          </div>
        )}
        <button
          type="button" aria-label="Commandes rapides" aria-expanded={menu} disabled={blocked || busy}
          onClick={() => setMenu((v) => !v)}
          className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-40"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <label htmlFor={`assistant-input-${variant}`} className="sr-only">Message à NemCopilotIA</label>
        <textarea
          id={`assistant-input-${variant}`}
          ref={areaRef}
          rows={1}
          maxLength={4000}
          value={input}
          disabled={blocked}
          placeholder={blocked ? 'NemCopilotIA en pause (quota gratuit atteint)' : 'Poser une question, ou taper / pour les commandes'}
          onChange={(e) => { setInput(e.target.value); setActive(0); grow() }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (slashOpen) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((activeIndex + 1) % slashMatches.length); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((activeIndex - 1 + slashMatches.length) % slashMatches.length); return }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); run(slashMatches[activeIndex]); return }
              if (e.key === 'Escape') { e.preventDefault(); setInput(''); return }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
          }}
          className="flex-1 bg-transparent outline-none text-sm py-2 px-1"
          style={{ resize: 'none', color: 'var(--text)', fontFamily: 'var(--font-poppins)', maxHeight: 160 }}
        />
        {canDictate && !busy && (
          <button
            type="button" aria-label={listening ? 'Arrêter la dictée' : 'Dicter un message'} aria-pressed={listening} disabled={blocked} onClick={toggleDictation}
            title="La dictée utilise le service vocal de ton navigateur"
            className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-40"
            style={{ color: listening ? 'var(--accent-contrast)' : 'var(--text-muted)', background: listening ? 'var(--accent)' : undefined }}
            data-testid="dictation"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" /><path d="M5 11a7 7 0 0014 0M12 18v4" /></svg>
          </button>
        )}
        {busy ? (
          <button type="button" aria-label="Arrêter la génération" onClick={() => stop()} className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" /></svg>
          </button>
        ) : (
          <button type="submit" aria-label="Envoyer" disabled={blocked || !input.trim()} className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-30" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        )}
      </form>
      <p className="text-[11px] text-center mt-2" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
        NemCopilotIA peut se tromper : vérifie avant d&apos;appliquer. Il ne modifie jamais ton site de lui-même.
      </p>
    </div>
  )

  const errorBox = error && (
    <div role="alert" className="text-sm px-3.5 py-2.5 mx-auto w-full" style={{ border: '1px solid #D90000', color: '#D90000', fontFamily: 'var(--font-poppins)' }}>{error.message}</div>
  )

  if (empty) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto">
        <div className={`w-full ${popover ? 'max-w-sm' : 'max-w-2xl'} flex flex-col items-center`}>
          <span className="w-12 h-12 flex items-center justify-center mb-4" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }} aria-hidden="true"><BotIcon width={28} height={28} /></span>
          <h2 className={`font-display font-semibold text-center mb-1 ${popover ? 'text-xl' : 'text-3xl'}`} style={{ color: 'var(--text)' }}>
            {firstName ? `Bonjour ${firstName}.` : 'Bonjour.'}
          </h2>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }} data-testid="assistant-briefing-line">
            {briefingSummary || 'Je connais ton portfolio : analyse, audit, statistiques, brouillons d’articles FR/EN.'}
          </p>
          {context && (
            <div className="w-full mb-4 px-3 py-2 text-xs" data-testid="assistant-context" style={{ border: '1px dashed var(--brand)', background: 'var(--surface)', color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              <span className="font-bold tracking-wider uppercase text-[10px]" style={{ color: 'var(--text)' }}>Page : </span>{context.label}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {context.chips.map((chip) => (
                  <button key={chip.label} type="button" disabled={blocked} onClick={() => run(chip)} className="text-xs px-2.5 py-1 transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] disabled:opacity-50" style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {composer}
          <div className={`mt-5 w-full grid gap-2 ${popover ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            {START_CARDS.map((card) => {
              const command = commandByName(card.command)
              if (!command) return null
              return (
                <button key={card.key} type="button" disabled={blocked} onClick={() => run(command)} className="card text-left px-3.5 py-3 disabled:opacity-50" style={{ fontFamily: 'var(--font-poppins)' }}>
                  <span className="block font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>{card.title}</span>
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{card.hint}</span>
                </button>
              )
            })}
          </div>
          {error && <div className="mt-4 w-full">{errorBox}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-5" aria-live="polite">
        <div className={`mx-auto space-y-6 ${popover ? '' : 'max-w-3xl'}`}>
          {messages.map((m, i) => (
            <Message key={m.id} message={m} last={i === messages.length - 1} busy={busy} onOpenDraft={onOpenDraft} onRegenerate={() => { clearError(); regenerate(requestOptions) }} />
          ))}
          {busy && (
            <p role="status" className="text-xs pl-10" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>NemCopilotIA travaille… (un article complet peut prendre une minute)</p>
          )}
          {errorBox}
        </div>
      </div>
      <div className={`px-4 pb-3 pt-1 mx-auto w-full ${popover ? '' : 'max-w-3xl'}`}>{composer}</div>
    </div>
  )
}
