'use client'

import { useMemo, useState } from 'react'
import type { ConversationDTO } from '@/lib/assistant/history'
import { conversationTitle, filterConversations } from '@/lib/assistant/conversation-search'
import Icon from '@/components/ui/Icon'

function Row({ icon, label, onClick, active, badge }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; badge?: number }) {
  return (
    <button
      type="button" onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--surface-hover)]"
      style={{ background: active ? 'var(--surface-hover)' : 'transparent', color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}
    >
      <span style={{ color: 'var(--text-muted)' }} aria-hidden="true">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge ? <span className="text-[11px] px-1.5" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>{badge}</span> : null}
    </button>
  )
}

interface Props {
  items: ConversationDTO[] | null
  activeConversationId: string
  draftCount: number
  onNew: () => void
  onSelect: (c: ConversationDTO) => void
  onDelete: (c: ConversationDTO) => void
  onPin: (c: ConversationDTO) => void
  onOpenDrafts: () => void
  onClose?: () => void
}

// The left column: new chat, the drafts, and the recent conversations (text only, kept for the
// retention period shown in the privacy page). Search narrows the list as you type; a pinned
// conversation stays at the top.
export default function ConversationSidebar({ items, activeConversationId, draftCount, onNew, onSelect, onDelete, onPin, onOpenDrafts, onClose }: Props) {
  const [query, setQuery] = useState('')
  const wrap = (fn: () => void) => () => { fn(); onClose?.() }
  const shown = useMemo(() => (items ? filterConversations(items, query) : null), [items, query])
  const pinnedCount = shown?.filter((c) => c.pinned).length ?? 0

  return (
    <nav className="h-full flex flex-col p-2.5 gap-0.5 overflow-y-auto" aria-label="Conversations">
      <Row active icon={<Icon name="edit" size={16} />} label="Nouveau chat" onClick={wrap(onNew)} />
      <Row icon={<Icon name="documents" size={16} />} label="Brouillons" badge={draftCount} onClick={wrap(onOpenDrafts)} />

      <div className="px-1 pt-3 pb-1">
        <label htmlFor="conversation-search" className="sr-only">Rechercher dans les conversations</label>
        <input
          id="conversation-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une conversation" autoComplete="off" maxLength={80}
          className="input text-xs w-full" data-testid="conversation-search"
        />
      </div>

      <p className="text-xs font-medium px-3 pt-2 pb-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{query ? 'Résultats' : 'Récents'}</p>
      {shown === null ? (
        <div className="mx-3 h-8 animate-pulse" style={{ background: 'var(--surface-hover)' }} />
      ) : items && items.length === 0 ? (
        <div className="px-3 text-xs space-y-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          <p>Aucune conversation pour le moment.</p>
          <p>Pose une question à NemCopilotIA ou tape <kbd className="px-1" style={{ border: '1px solid var(--border)' }}>/</kbd> pour voir les commandes : tes échanges apparaîtront ici.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="px-3 text-xs space-y-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }} data-testid="conversation-search-empty">
          <p>Aucune conversation ne contient « {query} ».</p>
          <button type="button" className="underline" style={{ color: 'var(--text-muted)' }} onClick={() => setQuery('')}>Effacer la recherche</button>
        </div>
      ) : (
        shown.map((c, i) => (
          <div key={c.id}>
            {i === 0 && pinnedCount > 0 && <p className="text-[10px] font-bold tracking-wider uppercase px-3 pb-1" style={{ color: 'var(--text-subtle)' }}>Épinglées</p>}
            {i === pinnedCount && pinnedCount > 0 && <p className="text-[10px] font-bold tracking-wider uppercase px-3 pt-2 pb-1" style={{ color: 'var(--text-subtle)' }}>Autres</p>}
            <div className="conv-row relative" data-pinned={c.pinned ? 'true' : 'false'}>
              <button
                type="button" onClick={wrap(() => onSelect(c))}
                className="w-full text-left pl-3 pr-14 py-2 text-sm truncate transition-colors hover:bg-[var(--surface-hover)]"
                style={{ background: c.conversationId === activeConversationId ? 'var(--surface-hover)' : 'transparent', color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}
              >
                {conversationTitle(c)}
              </button>
              <button
                type="button" aria-label={`${c.pinned ? 'Désépingler' : 'Épingler'} « ${conversationTitle(c)} »`} aria-pressed={c.pinned} onClick={() => onPin(c)}
                className="conv-delete absolute right-8 top-1/2 -translate-y-1/2 w-6 h-6 items-center justify-center"
                style={{ color: c.pinned ? 'var(--text)' : 'var(--text-subtle)', display: c.pinned ? 'flex' : undefined }}
              >
                <Icon name="pin" size={13} />
              </button>
              <button
                type="button" aria-label={`Supprimer « ${conversationTitle(c)} »`} onClick={() => onDelete(c)}
                className="conv-delete absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 items-center justify-center"
                style={{ color: 'var(--text-subtle)' }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        ))
      )}
    </nav>
  )
}
