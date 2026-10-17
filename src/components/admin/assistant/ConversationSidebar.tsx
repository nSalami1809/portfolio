'use client'

import type { ConversationDTO } from '@/lib/assistant/history'

const title = (c: ConversationDTO) => {
  const first = c.messages.find((m) => m.role === 'user')?.text ?? c.messages[0]?.text ?? 'Conversation'
  return first.replace(/\s+/g, ' ').slice(0, 60)
}

function Row({ icon, label, onClick, active, badge }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; badge?: number }) {
  return (
    <button
      type="button" onClick={onClick}
      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--surface-hover)]"
      style={{ background: active ? 'var(--surface-hover)' : 'transparent', color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}
    >
      <span style={{ color: 'var(--text-muted)' }} aria-hidden="true">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge ? <span className="text-[11px] rounded-full px-1.5" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>{badge}</span> : null}
    </button>
  )
}

const stroke = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

interface Props {
  items: ConversationDTO[] | null
  activeConversationId: string
  draftCount: number
  onNew: () => void
  onSelect: (c: ConversationDTO) => void
  onDelete: (c: ConversationDTO) => void
  onOpenDrafts: () => void
  onClose?: () => void
}

// The left column: new chat, the drafts, and the recent conversations (text only,
// kept for the retention period shown in the privacy page).
export default function ConversationSidebar({ items, activeConversationId, draftCount, onNew, onSelect, onDelete, onOpenDrafts, onClose }: Props) {
  const wrap = (fn: () => void) => () => { fn(); onClose?.() }
  return (
    <nav className="h-full flex flex-col p-2.5 gap-0.5 overflow-y-auto" aria-label="Conversations">
      <Row active icon={<svg {...stroke}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>} label="Nouveau chat" onClick={wrap(onNew)} />
      <Row icon={<svg {...stroke}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></svg>} label="Brouillons" badge={draftCount} onClick={wrap(onOpenDrafts)} />
      <p className="text-xs font-medium px-3 pt-4 pb-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>Récents</p>
      {items === null ? (
        <div className="mx-3 h-8 rounded-lg animate-pulse" style={{ background: 'var(--surface-hover)' }} />
      ) : items.length === 0 ? (
        <p className="px-3 text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>Aucune conversation pour le moment.</p>
      ) : (
        items.map((c) => (
          <div key={c.id} className="conv-row relative">
            <button
              type="button" onClick={wrap(() => onSelect(c))}
              className="w-full text-left rounded-xl pl-3 pr-8 py-2 text-sm truncate transition-colors hover:bg-[var(--surface-hover)]"
              style={{ background: c.conversationId === activeConversationId ? 'var(--surface-hover)' : 'transparent', color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}
            >
              {title(c)}
            </button>
            <button
              type="button" aria-label={`Supprimer « ${title(c)} »`} onClick={() => onDelete(c)}
              className="conv-delete absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md items-center justify-center"
              style={{ color: 'var(--text-subtle)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
            </button>
          </div>
        ))
      )}
    </nav>
  )
}
