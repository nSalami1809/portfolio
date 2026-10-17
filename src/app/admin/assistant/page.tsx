'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import StatusBar from '@/components/admin/assistant/StatusBar'
import BriefingCard from '@/components/admin/assistant/BriefingCard'
import ChatPane from '@/components/admin/assistant/ChatPane'
import ConversationSidebar from '@/components/admin/assistant/ConversationSidebar'
import DraftsPanel from '@/components/admin/assistant/DraftsPanel'
import { useToast } from '@/components/admin/Toast'
import { deleteAssistantConversation, getAssistantStatus, listAssistantConversations, listAssistantDrafts } from '@/actions/assistant'
import { getDailyBriefing } from '@/actions/briefing'
import type { AssistantStatus } from '@/lib/assistant/guard'
import type { Briefing } from '@/lib/briefing'
import type { DraftDTO } from '@/lib/assistant/drafts'
import type { ConversationDTO } from '@/lib/assistant/history'

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`)

// A saved conversation keeps the text only: it comes back as plain text messages
// (the "[tool]" markers of the log are dropped) and can be continued.
function toUiMessages(c: ConversationDTO): UIMessage[] {
  return c.messages.map((m, i) => ({
    id: `${c.conversationId}-${i}`,
    role: m.role,
    parts: [{ type: 'text' as const, text: m.text.split('\n').filter((l) => !/^\[[A-Za-z]+\]$/.test(l.trim())).join('\n').trim() }],
  })).filter((m) => m.parts[0].text)
}

export default function AdminAssistantPage() {
  const toast = useToast()
  const [status, setStatus] = useState<AssistantStatus | null>(null)
  const [drafts, setDrafts] = useState<DraftDTO[]>([])
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [conversations, setConversations] = useState<ConversationDTO[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chat, setChat] = useState<{ id: string; initial: UIMessage[] }>(() => ({ id: newId(), initial: [] }))
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pendingDraft = useRef<string | null>(null)

  const refreshAll = useCallback(async () => {
    const [s, d, c] = await Promise.allSettled([getAssistantStatus(), listAssistantDrafts(), listAssistantConversations()])
    if (s.status === 'fulfilled') setStatus(s.value)
    if (d.status === 'fulfilled') setDrafts(d.value)
    if (c.status === 'fulfilled') setConversations(c.value)
  }, [])

  // First load. A link like /admin/assistant?draft=ID (from the floating robot) opens that draft.
  useEffect(() => {
    let alive = true
    pendingDraft.current = new URLSearchParams(window.location.search).get('draft')
    Promise.allSettled([getAssistantStatus(), listAssistantDrafts(), listAssistantConversations(), getDailyBriefing()]).then(([s, d, c, b]) => {
      if (!alive) return
      if (s.status === 'fulfilled') setStatus(s.value)
      if (d.status === 'fulfilled') {
        setDrafts(d.value)
        if (pendingDraft.current && d.value.some((x) => x.id === pendingDraft.current)) { setSelectedId(pendingDraft.current); setDraftsOpen(true) }
        if (pendingDraft.current) window.history.replaceState(null, '', window.location.pathname)
      }
      if (c.status === 'fulfilled') setConversations(c.value)
      if (b.status === 'fulfilled') setBriefing(b.value)
    })
    return () => { alive = false }
  }, [])

  const refreshBriefing = useCallback(() => { getDailyBriefing().then(setBriefing, () => undefined) }, [])

  const onTurnFinished = useCallback(() => {
    refreshAll()
    refreshBriefing()
    setTimeout(refreshAll, 2000) // the conversation is saved as the stream closes
  }, [refreshAll, refreshBriefing])

  const openDraft = useCallback((id: string) => {
    listAssistantDrafts().then((d) => { setDrafts(d); setSelectedId(id); setDraftsOpen(true) }, () => undefined)
  }, [])

  const startNew = () => setChat({ id: newId(), initial: [] })
  const openConversation = (c: ConversationDTO) => setChat({ id: c.conversationId, initial: toUiMessages(c) })
  const removeConversation = async (c: ConversationDTO) => {
    if (!confirm('Supprimer cette conversation de l’historique ?')) return
    const r = await deleteAssistantConversation(c.id)
    if (!r.ok) { toast('Suppression impossible.', 'error'); return }
    setConversations((prev) => (prev ?? []).filter((x) => x.id !== c.id))
    if (c.conversationId === chat.id) startNew()
    toast('Conversation supprimée.')
  }

  // The pause is computed by the server; StatusBar triggers a refresh when its countdown ends.
  const blocked = Boolean(status && (!status.enabled || status.modelError || status.paused))
  const chatModel = status?.models.find((m) => m.role === 'chat')
  const used = chatModel?.usedToday ?? 0
  const cap = chatModel?.dailyCap ?? 0
  const activeDrafts = drafts.filter((d) => d.status === 'draft').length

  const sidebar = (onClose?: () => void) => (
    <ConversationSidebar
      items={conversations} activeConversationId={chat.id} draftCount={activeDrafts}
      onNew={startNew} onSelect={openConversation} onDelete={removeConversation}
      onOpenDrafts={() => setDraftsOpen(true)} onClose={onClose}
    />
  )

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Assistant IA</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>Tu relis et tu décides : rien n&apos;est appliqué au site sans ton clic.</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" aria-expanded={infoOpen} onClick={() => setInfoOpen((v) => !v)}>
          {infoOpen ? 'Masquer le briefing et le quota' : 'Briefing et quota'}
        </button>
      </div>

      {(infoOpen || blocked) && (
        <>
          <StatusBar status={status} onExpire={refreshAll} />
          <BriefingCard briefing={briefing} onRefresh={refreshBriefing} />
        </>
      )}

      <div className="card no-lift relative flex overflow-hidden" style={{ height: 'calc(100dvh - 10.5rem)', minHeight: 520, padding: 0 }}>
        <aside className="hidden lg:block w-64 flex-shrink-0" style={{ borderRight: '1px solid var(--border)' }}>{sidebar()}</aside>

        <section className="flex-1 min-w-0 flex flex-col" aria-label="Conversation avec l'assistant">
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <button type="button" className="lg:hidden btn-secondary btn-xs" aria-label="Ouvrir la liste des conversations" onClick={() => setMenuOpen(true)}>☰</button>
            <span className="flex-1" />
            <span className="text-xs px-2.5 py-1" style={{ border: '1px solid var(--border)', color: blocked ? '#D90000' : 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }} title="Requêtes du palier gratuit utilisées aujourd'hui par le modèle de conversation (sous la limite de Google, marge incluse)">
              {blocked ? 'En pause' : status ? `${used} / ${cap} requêtes` : '…'}
            </span>
            <button type="button" className="btn-secondary btn-xs" aria-pressed={draftsOpen} onClick={() => setDraftsOpen((v) => !v)}>
              Brouillons{activeDrafts ? ` (${activeDrafts})` : ''}
            </button>
          </div>
          <ChatPane key={chat.id} conversationId={chat.id} initialMessages={chat.initial} variant="page" blocked={blocked} onTurnFinished={onTurnFinished} onOpenDraft={openDraft} />
        </section>

        {draftsOpen && (
          <aside className="absolute inset-0 z-20 lg:static lg:inset-auto lg:z-auto w-full lg:w-[440px] flex-shrink-0" style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
            <DraftsPanel
              embedded
              drafts={drafts}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onClose={() => setDraftsOpen(false)}
              onChanged={(d) => setDrafts((prev) => prev.map((x) => (x.id === d.id ? d : x)))}
              onDiscarded={(id) => { setDrafts((prev) => prev.filter((x) => x.id !== id)); setSelectedId(null) }}
            />
          </aside>
        )}

        {menuOpen && (
          <div className="lg:hidden absolute inset-0 z-30 flex" role="dialog" aria-label="Conversations">
            <div className="w-72 max-w-[85%] h-full" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>{sidebar(() => setMenuOpen(false))}</div>
            <button type="button" aria-label="Fermer" className="flex-1" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setMenuOpen(false)} />
          </div>
        )}
      </div>
    </>
  )
}
