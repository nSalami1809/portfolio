'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import ChatMarkdown from '@/components/chat/ChatMarkdown'

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`)

const SUGGESTIONS = [
  "Fais l'audit qualité de mon portfolio et dis-moi les 5 priorités.",
  "Analyse mes projets et identifie les compétences techniques qui ne sont pas suffisamment représentées dans mon portfolio.",
  "Prépare un nouvel article de blog sur mon expérience de développement chez SING SA. Propose un titre, rédige le contenu en Markdown et prépare une version anglaise.",
  "Quels sont mes articles les plus lus, et que me conseilles-tu d'écrire ensuite ?",
  'Que demandent mes visiteurs au chatbot, et à quelles questions ne répond-il pas bien ?',
]

const TOOL_LABELS: Record<string, string> = {
  getProfile: 'Lecture du profil',
  listProjects: 'Liste des projets',
  getProject: 'Lecture d’un projet',
  listBlogPosts: 'Liste des articles',
  getBlogPost: 'Lecture d’un article',
  getSkills: 'Lecture des compétences',
  listExperiences: 'Lecture des expériences',
  listOffers: 'Lecture des offres',
  auditPortfolio: 'Audit du portfolio',
  getSiteStats: 'Statistiques d’audience',
  getBusinessOverview: 'Synthèse d’activité',
  checkSlug: 'Vérification du slug',
  listDocuments: 'Liste des documents',
  analyzeDocument: 'Lecture d’un document',
  analyzeChatLogs: 'Analyse des conversations du chatbot',
  listMyDrafts: 'Liste des brouillons',
  draftBlogPost: 'Rédaction d’un article (FR + EN)',
  draftFieldPatch: 'Réécriture d’un champ',
  reviseDraft: 'Révision d’un brouillon',
}

interface ToolPartLike { type: string; state?: string; output?: unknown; input?: unknown; toolCallId?: string }

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
      {draftId && (
        <button type="button" className="btn-secondary btn-xs" onClick={() => onOpenDraft(draftId)}>Ouvrir le brouillon</button>
      )}
    </div>
  )
}

function Message({ message, onOpenDraft }: { message: UIMessage; onOpenDraft: (id: string) => void }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="text-sm rounded-2xl px-4 py-3 max-w-[92%]"
        style={{
          background: isUser ? 'var(--accent)' : 'var(--surface)',
          color: isUser ? '#fff' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border)',
          fontFamily: 'var(--font-poppins)',
        }}
      >
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return isUser
              ? <p key={i} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{part.text}</p>
              : <ChatMarkdown key={i} text={part.text} safeImages />
          }
          if (part.type.startsWith('tool-')) return <ToolTrace key={i} part={part as ToolPartLike} onOpenDraft={onOpenDraft} />
          return null
        })}
      </div>
    </div>
  )
}

interface Props {
  blocked: boolean
  onTurnFinished: () => void
  onOpenDraft: (id: string) => void
}

export default function AssistantChat({ blocked, onTurnFinished, onOpenDraft }: Props) {
  const [conversationId, setConversationId] = useState(newId)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/admin-assistant', body: { conversationId } }), [conversationId])
  const { messages, sendMessage, status, stop, error, clearError } = useChat({ id: conversationId, transport })

  const busy = status === 'submitted' || status === 'streaming'

  // Refresh the meter and the drafts list when a turn ends (success, stop or error).
  const wasBusy = useRef(false)
  useEffect(() => {
    if (busy) { wasBusy.current = true; return }
    if (wasBusy.current) { wasBusy.current = false; onTurnFinished() }
  }, [busy, onTurnFinished])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, status])

  const send = (text: string) => {
    const value = text.trim()
    if (!value || busy || blocked) return
    clearError()
    sendMessage({ text: value })
    setInput('')
  }

  const lastIsUser = messages[messages.length - 1]?.role === 'user'

  return (
    <section className="card no-lift flex flex-col" style={{ minHeight: 520, maxHeight: '75dvh' }} aria-label="Conversation avec l'assistant">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>Conversation</h2>
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={busy}
          onClick={() => { setConversationId(newId()); setInput('') }}
        >
          Nouvelle conversation
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              Demande-moi d&apos;analyser ton portfolio, de repérer ce qui manque ou de préparer un brouillon d&apos;article. Chaque réponse consomme une partie du quota gratuit : sois précis plutôt que bavard.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" disabled={blocked} onClick={() => send(s)} className="btn-secondary btn-sm text-left" style={{ whiteSpace: 'normal', height: 'auto', padding: '0.5rem 0.75rem' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Message key={m.id} message={m} onOpenDraft={onOpenDraft} />)
        )}

        {busy && (lastIsUser || status === 'submitted') && (
          <p role="status" className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>L&apos;assistant travaille… (un article complet peut prendre une minute)</p>
        )}
        {error && (
          <div role="alert" className="text-sm rounded-xl px-3 py-2" style={{ border: '1px solid #D90000', color: '#D90000', fontFamily: 'var(--font-poppins)' }}>
            {error.message}
          </div>
        )}
      </div>

      <form
        className="p-3 flex gap-2 items-end"
        style={{ borderTop: '1px solid var(--border)' }}
        onSubmit={(e) => { e.preventDefault(); send(input) }}
      >
        <label htmlFor="assistant-input" className="sr-only">Message à l&apos;assistant</label>
        <textarea
          id="assistant-input"
          className="input flex-1"
          rows={2}
          maxLength={4000}
          value={input}
          disabled={blocked}
          placeholder={blocked ? 'Assistant en pause (quota gratuit atteint)' : 'Écris ta demande… (Entrée pour envoyer, Maj+Entrée pour un retour à la ligne)'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) } }}
          style={{ resize: 'none' }}
        />
        {busy ? (
          <button type="button" className="btn-danger btn-sm" onClick={() => stop()}>Arrêter</button>
        ) : (
          <button type="submit" className="btn-primary btn-sm" disabled={blocked || !input.trim()}>Envoyer</button>
        )}
      </form>
    </section>
  )
}
