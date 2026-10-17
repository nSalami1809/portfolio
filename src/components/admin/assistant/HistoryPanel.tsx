'use client'

import { useEffect, useState } from 'react'
import ChatMarkdown from '@/components/chat/ChatMarkdown'
import { useToast } from '@/components/admin/Toast'
import { RETENTION_DAYS } from '@/lib/chat-log-config'
import { deleteAssistantConversation, listAssistantConversations } from '@/actions/assistant'
import type { ConversationDTO } from '@/lib/assistant/history'

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Past conversations, read-only: the text of the exchange (tool results, which
// carry site data, are never kept) for RETENTION_DAYS days.
export default function HistoryPanel({ refreshKey }: { refreshKey: number }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ConversationDTO[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    listAssistantConversations().then((list) => { if (alive) setItems(list) }, () => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [open, refreshKey])

  const remove = async (c: ConversationDTO) => {
    if (!confirm('Supprimer cette conversation de l’historique ?')) return
    const r = await deleteAssistantConversation(c.id)
    if (r.ok) { setItems((prev) => (prev ?? []).filter((x) => x.id !== c.id)); toast('Conversation supprimée.') } else toast('Suppression impossible.', 'error')
  }

  return (
    <section className="mt-6">
      <button type="button" className="btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Masquer l’historique' : 'Historique des conversations'}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            Le texte des échanges est conservé {RETENTION_DAYS} jours, puis supprimé automatiquement.
          </p>
          {items === null ? (
            <div className="card no-lift p-4 animate-pulse" style={{ height: 56 }} />
          ) : items.length === 0 ? (
            <div className="card no-lift p-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Aucune conversation enregistrée.</div>
          ) : items.map((c) => {
            const first = c.messages.find((m) => m.role === 'user')?.text ?? c.messages[0]?.text ?? ''
            const expanded = openId === c.id
            return (
              <div key={c.id} className="card no-lift p-4">
                <button type="button" className="w-full text-left flex items-start justify-between gap-3" aria-expanded={expanded} onClick={() => setOpenId(expanded ? null : c.id)}>
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{first || '(vide)'}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{c.messages.length} message{c.messages.length > 1 ? 's' : ''} · {when(c.updatedAt)}</p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{expanded ? 'Réduire' : 'Lire'}</span>
                </button>
                {expanded && (
                  <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                    {c.messages.map((m, i) => (
                      <div key={i} className="text-sm" style={{ color: m.role === 'user' ? 'var(--text)' : 'var(--text-muted)' }}>
                        <span className="text-[10px] font-bold tracking-wider uppercase mr-2" style={{ color: m.role === 'user' ? 'var(--accent)' : 'var(--text-subtle)' }}>{m.role === 'user' ? 'Toi' : 'Assistant'}</span>
                        {m.role === 'user' ? <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</span> : <ChatMarkdown text={m.text} safeImages />}
                      </div>
                    ))}
                    <button type="button" className="btn-danger btn-sm" onClick={() => remove(c)}>Supprimer</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
