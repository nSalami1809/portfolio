'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import ChatMarkdown from '@/components/chat/ChatMarkdown'
import { BotIcon } from '@/components/chat/BotIcon'
import { useEscapeKey } from '@/hooks/useEscapeKey'

const SUGGESTIONS = [
  { label: 'Auditer mon portfolio', text: "Fais l'audit qualité de mon portfolio et dis-moi les 5 priorités." },
  { label: 'Compétences à mettre en avant', text: 'Analyse mes projets et identifie les compétences techniques qui ne sont pas suffisamment représentées dans mon portfolio.' },
  { label: 'Rédiger un article FR + EN', text: 'Prépare un nouvel article de blog sur mon expérience de développement chez SING SA. Propose un titre, rédige le contenu en Markdown et prépare une version anglaise.' },
  { label: 'Que dois-je traiter aujourd’hui ?', text: "Que dois-je traiter aujourd'hui ?" },
  { label: 'Ce que demandent mes visiteurs', text: 'Que demandent mes visiteurs au chatbot, et à quelles questions ne répond-il pas bien ?' },
  { label: 'Mes articles les plus lus', text: "Quels sont mes articles les plus lus, et que me conseilles-tu d'écrire ensuite ?" },
]

const TOOL_LABELS: Record<string, string> = {
  getProfile: 'Lecture du profil', listProjects: 'Liste des projets', getProject: 'Lecture d’un projet', listBlogPosts: 'Liste des articles',
  getBlogPost: 'Lecture d’un article', getSkills: 'Lecture des compétences', listExperiences: 'Lecture des expériences', listOffers: 'Lecture des offres',
  auditPortfolio: 'Audit du portfolio', getSiteStats: 'Statistiques d’audience', getBusinessOverview: 'Synthèse d’activité', checkSlug: 'Vérification du slug',
  getDailyBriefing: 'Briefing du jour', listDocuments: 'Liste des documents', analyzeDocument: 'Lecture d’un document',
  analyzeChatLogs: 'Analyse des conversations du chatbot', listMyDrafts: 'Liste des brouillons', draftBlogPost: 'Rédaction d’un article (FR + EN)',
  draftFieldPatch: 'Réécriture d’un champ', reviseDraft: 'Révision d’un brouillon',
}

interface ToolPartLike { type: string; state?: string; output?: unknown }

function ToolTrace({ part, onOpenDraft }: { part: ToolPartLike; onOpenDraft: (id: string) => void }) {
  const name = part.type.slice(5)
  const out = part.output as { error?: string; draftId?: string } | undefined
  const failed = part.state === 'output-error' || Boolean(out && typeof out === 'object' && out.error)
  const done = part.state === 'output-available'
  const draftId = done && out && typeof out === 'object' ? out.draftId : undefined
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs my-1" style={{ color: failed ? '#D90000' : 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
      <span aria-hidden="true">{failed ? '✕' : done ? '✓' : '…'}</span>
      <span>{TOOL_LABELS[name] ?? name}{failed && out?.error ? ` — ${out.error}` : ''}</span>
      {draftId && <button type="button" className="btn-secondary btn-xs" onClick={() => onOpenDraft(draftId)}>Ouvrir le brouillon</button>}
    </div>
  )
}

function Message({ message, onOpenDraft }: { message: UIMessage; onOpenDraft: (id: string) => void }) {
  if (message.role === 'user') {
    const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
    return (
      <div className="flex justify-end">
        <p className="text-sm px-4 py-2.5 max-w-[85%]" style={{ background: 'var(--surface-hover)', color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'var(--font-poppins)' }}>{text}</p>
      </div>
    )
  }
  return (
    <div className="flex gap-3">
      <span className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }} aria-hidden="true">
        <BotIcon width={15} height={15} />
      </span>
      <div className="min-w-0 flex-1 text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
        {message.parts.map((part, i) => {
          if (part.type === 'text') return <ChatMarkdown key={i} text={part.text} safeImages />
          if (part.type.startsWith('tool-')) return <ToolTrace key={i} part={part as ToolPartLike} onOpenDraft={onOpenDraft} />
          return null
        })}
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
  onTurnFinished: () => void
  onOpenDraft: (id: string) => void
}

// One conversation, in the style of a modern chat app: a greeting and a
// composer while it is empty, then the messages with the composer pinned below.
export default function ChatPane({ conversationId, initialMessages, variant, blocked, onTurnFinished, onOpenDraft }: Props) {
  const popover = variant === 'popover'
  const [input, setInput] = useState('')
  const [menu, setMenu] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/admin-assistant', body: { conversationId } }), [conversationId])
  const { messages, sendMessage, status, stop, error, clearError } = useChat({ id: conversationId, messages: initialMessages, transport })
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

  const closeMenu = useCallback(() => setMenu(false), [])
  useEscapeKey(menu, closeMenu)

  const grow = () => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const send = (text: string) => {
    const value = text.trim()
    if (!value || busy || blocked) return
    clearError()
    setMenu(false)
    sendMessage({ text: value })
    setInput('')
    requestAnimationFrame(grow)
  }

  const composer = (
    <div className="w-full">
      <form
        className="relative flex items-end gap-1.5 px-2.5 py-2"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 2px 14px rgba(0,0,0,0.08)' }}
        onSubmit={(e) => { e.preventDefault(); send(input) }}
      >
        {menu && (
          <div className="absolute bottom-full left-0 mb-2 w-72 max-w-[85vw] p-1.5 z-10" role="menu" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.18)' }}>
            {SUGGESTIONS.map((s) => (
              <button key={s.label} type="button" role="menuitem" className="w-full text-left text-sm px-3 py-2 transition-colors hover:bg-[var(--surface-hover)]" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }} onClick={() => send(s.text)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button" aria-label="Actions rapides" aria-expanded={menu} disabled={blocked || busy}
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
          placeholder={blocked ? 'NemCopilotIA en pause (quota gratuit atteint)' : 'Poser une question'}
          onChange={(e) => { setInput(e.target.value); grow() }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) } }}
          className="flex-1 bg-transparent outline-none text-sm py-2 px-1"
          style={{ resize: 'none', color: 'var(--text)', fontFamily: 'var(--font-poppins)', maxHeight: 160 }}
        />
        {busy ? (
          <button type="button" aria-label="Arrêter la génération" onClick={() => stop()} className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /></svg>
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
          <span className="w-12 h-12 flex items-center justify-center mb-4" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }} aria-hidden="true"><BotIcon width={26} height={26} /></span>
          <h2 className={`font-display font-semibold text-center mb-1 ${popover ? 'text-xl' : 'text-3xl'}`} style={{ color: 'var(--text)' }}>Par quoi commençons-nous ?</h2>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Je connais ton portfolio : analyse, audit, statistiques, brouillons d&apos;articles FR/EN.
          </p>
          {composer}
          <div className={`mt-5 w-full grid gap-2 ${popover ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            {SUGGESTIONS.slice(0, popover ? 4 : 6).map((s) => (
              <button key={s.label} type="button" disabled={blocked} onClick={() => send(s.text)} className="text-left text-sm px-3.5 py-2.5 transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                {s.label}
              </button>
            ))}
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
          {messages.map((m) => <Message key={m.id} message={m} onOpenDraft={onOpenDraft} />)}
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
