'use client'

import { useCallback, useEffect, useState } from 'react'
import StatusBar from '@/components/admin/assistant/StatusBar'
import AssistantChat from '@/components/admin/assistant/AssistantChat'
import DraftsPanel from '@/components/admin/assistant/DraftsPanel'
import HistoryPanel from '@/components/admin/assistant/HistoryPanel'
import { getAssistantStatus, listAssistantDrafts } from '@/actions/assistant'
import type { AssistantStatus } from '@/lib/assistant/guard'
import type { DraftDTO } from '@/lib/assistant/drafts'

export default function AdminAssistantPage() {
  const [status, setStatus] = useState<AssistantStatus | null>(null)
  const [drafts, setDrafts] = useState<DraftDTO[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'chat' | 'drafts'>('chat')
  const [turns, setTurns] = useState(0)

  const refresh = useCallback(async () => {
    const [s, d] = await Promise.allSettled([getAssistantStatus(), listAssistantDrafts()])
    if (s.status === 'fulfilled') setStatus(s.value)
    if (d.status === 'fulfilled') setDrafts(d.value)
  }, [])

  // First load. (Later refreshes come from onTurnFinished / onExpire / openDraft.)
  useEffect(() => {
    let alive = true
    Promise.allSettled([getAssistantStatus(), listAssistantDrafts()]).then(([s, d]) => {
      if (!alive) return
      if (s.status === 'fulfilled') setStatus(s.value)
      if (d.status === 'fulfilled') setDrafts(d.value)
    })
    return () => { alive = false }
  }, [])

  const onTurnFinished = useCallback(() => { setTurns((n) => n + 1); refresh() }, [refresh])
  const openDraft = useCallback((id: string) => {
    refresh().then(() => { setSelectedId(id); setTab('drafts') })
  }, [refresh])

  // blockedUntil is cleared by the server once it has passed; StatusBar triggers that refresh when its countdown ends.
  const blocked = Boolean(status && (!status.enabled || status.modelError || status.blockedUntil))

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>Assistant IA</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Analyse ton portfolio, repère ce qui manque et prépare des brouillons (articles FR/EN, réécritures). Tu relis, tu décides, tu publies toi-même.
        </p>
      </div>

      <StatusBar status={status} onExpire={refresh} />

      <div className="lg:hidden flex gap-2 mb-3" role="tablist" aria-label="Affichage">
        <button type="button" role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab('chat')}>Conversation</button>
        <button type="button" role="tab" aria-selected={tab === 'drafts'} className={tab === 'drafts' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab('drafts')}>Brouillons ({drafts.length})</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className={`lg:col-span-3 ${tab === 'chat' ? '' : 'hidden lg:block'}`}>
          <AssistantChat blocked={blocked} onTurnFinished={onTurnFinished} onOpenDraft={openDraft} />
        </div>
        <div className={`lg:col-span-2 ${tab === 'drafts' ? '' : 'hidden lg:block'}`}>
          <DraftsPanel
            drafts={drafts}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChanged={(d) => setDrafts((prev) => prev.map((x) => (x.id === d.id ? d : x)))}
            onDiscarded={(id) => { setDrafts((prev) => prev.filter((x) => x.id !== id)); setSelectedId(null) }}
          />
        </div>
      </div>

      <HistoryPanel refreshKey={turns} />
    </>
  )
}
