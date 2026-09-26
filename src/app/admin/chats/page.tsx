'use client'

import { useCallback, useEffect, useState } from 'react'
import { listChats, markChatRead, deleteChat, type AdminChat } from '@/actions/chats'
import { useToast } from '@/components/admin/Toast'
import { RETENTION_DAYS } from '@/lib/chat-log-config'

const formatDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// What visitors ask the chatbot — text only, kept for a limited time (see the
// privacy policy). Useful to spot recurring questions and warm leads.
export default function AdminChats() {
  const toast = useToast()
  const [chats, setChats] = useState<AdminChat[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setChats(await listChats()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const open = async (chat: AdminChat) => {
    const next = openId === chat.id ? null : chat.id
    setOpenId(next)
    if (next && !chat.read) {
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, read: true } : c)))
      markChatRead(chat.id).catch(() => {})
    }
  }

  const remove = async (chat: AdminChat) => {
    if (!confirm('Supprimer cette conversation ?')) return
    const result = await deleteChat(chat.id)
    if (result.ok) { setChats((prev) => prev.filter((c) => c.id !== chat.id)); toast('Conversation supprimée.') }
    else toast('Suppression impossible.', 'error')
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>Conversations du chatbot</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Le texte des échanges est conservé {RETENTION_DAYS} jours, puis supprimé automatiquement.
        </p>
      </div>

      {loading ? (
        <div className="card no-lift p-4 animate-pulse" style={{ height: 72 }} />
      ) : chats.length === 0 ? (
        <div className="card no-lift p-10 text-center">
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucune conversation</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Les échanges des visiteurs avec l&apos;assistant apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const first = chat.messages.find((m) => m.role === 'user')?.text ?? chat.messages[0]?.text ?? ''
            const expanded = openId === chat.id
            return (
              <div key={chat.id} className="card no-lift p-4">
                <button type="button" onClick={() => open(chat)} className="w-full text-left flex items-start justify-between gap-3" aria-expanded={expanded}>
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text)', fontWeight: chat.read ? 400 : 700 }}>
                      {!chat.read && <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: 'var(--accent)' }} aria-label="Non lue" />}
                      {first || '(vide)'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                      {chat.messages.length} message{chat.messages.length > 1 ? 's' : ''} · {chat.locale.toUpperCase()} · {formatDate(chat.updatedAt)}
                    </p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{expanded ? 'Réduire' : 'Lire'}</span>
                </button>

                {expanded && (
                  <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                    {chat.messages.map((m, i) => (
                      <div key={i} className="text-sm" style={{ color: m.role === 'user' ? 'var(--text)' : 'var(--text-muted)' }}>
                        <span className="text-[10px] font-bold tracking-wider uppercase mr-2" style={{ color: m.role === 'user' ? 'var(--accent)' : 'var(--text-subtle)' }}>
                          {m.role === 'user' ? 'Visiteur' : 'Assistant'}
                        </span>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                      </div>
                    ))}
                    <button type="button" onClick={() => remove(chat)} className="text-xs font-medium" style={{ color: '#D90000' }}>Supprimer cette conversation</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
