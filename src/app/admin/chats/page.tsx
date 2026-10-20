'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listChats, markChatRead, deleteChat, getInstantStats, type AdminChat } from '@/actions/chats'
import type { InstantStats } from '@/lib/chat-instant-stats'
import { useToast } from '@/components/admin/Toast'
import { RETENTION_DAYS } from '@/lib/chat-log-config'
import { CHAT_TAGS, CHAT_TAG_LABEL, matchesFilter, type ChatFilter } from '@/lib/chat-triage'

const formatDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// What visitors ask the chatbot — text only, kept for a limited time (see the
// privacy policy). Useful to spot recurring questions and warm leads. Each
// conversation is sorted by the code (type of request, lead signal, unanswered
// question): no model, no quota.
export default function AdminChats() {
  const toast = useToast()
  const [chats, setChats] = useState<AdminChat[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ChatFilter>('all')
  const [instant, setInstant] = useState<InstantStats | null>(null)

  const load = useCallback(async () => {
    try { setChats(await listChats()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { getInstantStats().then(setInstant, () => undefined) }, [])

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

  const filters = useMemo(() => {
    const count = (f: ChatFilter) => chats.filter((c) => matchesFilter(c.triage, f)).length
    const base: { key: ChatFilter; label: string }[] = [
      { key: 'all', label: 'Toutes' },
      { key: 'lead', label: 'Contacts possibles' },
      { key: 'unanswered', label: 'Sans réponse' },
      { key: 'disliked', label: 'Pouce bas' },
    ]
    const tags = CHAT_TAGS.map((t) => ({ key: t as ChatFilter, label: CHAT_TAG_LABEL[t] }))
    return [...base, ...tags].map((f) => ({ ...f, n: count(f.key) })).filter((f) => f.key === 'all' || f.n > 0)
  }, [chats])

  const shown = chats.filter((c) => matchesFilter(c.triage, filter))

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>Conversations du chatbot</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Le texte des échanges est conservé {RETENTION_DAYS} jours, puis supprimé automatiquement. Le tri (type de demande, contact possible, question sans réponse) est fait par des règles, sans IA.
        </p>
      </div>

      {instant && (
        <p className="text-xs mb-4 px-3 py-2" data-testid="instant-stats" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          <strong style={{ color: 'var(--text)' }}>{instant.today}</strong> question{instant.today > 1 ? 's' : ''} répondue{instant.today > 1 ? 's' : ''} sans IA aujourd&apos;hui ({instant.last7Days} sur 7 jours) : autant de requêtes Gemini gratuites non dépensées.
        </p>
      )}

      {loading ? (
        <div className="card no-lift p-4 animate-pulse" style={{ height: 72 }} />
      ) : chats.length === 0 ? (
        <div className="card no-lift p-10 text-center">
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucune conversation</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Les échanges des visiteurs avec NemCopilotIA apparaîtront ici.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4" role="group" aria-label="Filtrer les conversations">
            {filters.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={filter === f.key ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'}>
                {f.label} <span style={{ opacity: 0.7 }}>{f.n}</span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="card no-lift p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Aucune conversation dans ce filtre.</div>
          ) : (
            <div className="space-y-2">
              {shown.map((chat) => {
                const expanded = openId === chat.id
                const { tag, lead, unanswered, summary, up, down } = chat.triage
                return (
                  <div key={chat.id} className="card no-lift p-4">
                    <button type="button" onClick={() => open(chat)} className="w-full text-left flex items-start justify-between gap-3" aria-expanded={expanded}>
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text)', fontWeight: chat.read ? 400 : 700 }}>
                          {!chat.read && <span className="inline-block w-2 h-2 mr-2" style={{ background: 'var(--accent)' }} aria-label="Non lue" />}
                          {summary || '(vide)'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[11px] px-2 py-0.5" data-testid="chat-tag" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)' }}>{CHAT_TAG_LABEL[tag]}</span>
                          {lead && <span className="text-[11px] px-2 py-0.5 font-semibold" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>Contact possible</span>}
                          {unanswered && <span className="text-[11px] px-2 py-0.5" style={{ border: '1px solid var(--warn, #A16207)', color: 'var(--warn, #A16207)' }}>Sans réponse</span>}
                          {down > 0 && <span className="text-[11px] px-2 py-0.5" data-testid="chat-disliked" style={{ border: '1px solid #D90000', color: '#D90000' }}>À améliorer ({down})</span>}
                          {up > 0 && down === 0 && <span className="text-[11px] px-2 py-0.5" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Utile ({up})</span>}
                          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                            {chat.messages.length} message{chat.messages.length > 1 ? 's' : ''} · {chat.locale.toUpperCase()} · {formatDate(chat.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{expanded ? 'Réduire' : 'Lire'}</span>
                    </button>

                    {expanded && (
                      <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                        {chat.messages.map((m, i) => (
                          <div key={i} className="text-sm" style={{ color: m.role === 'user' ? 'var(--text)' : 'var(--text-muted)' }}>
                            <span className="text-[10px] font-bold tracking-wider uppercase mr-2" style={{ color: m.role === 'user' ? 'var(--accent)' : 'var(--text-subtle)' }}>
                              {m.role === 'user' ? 'Visiteur' : 'NemCopilotIA'}
                            </span>
                            {chat.ratings[i] && <span className="text-[10px] mr-2 px-1.5 py-0.5" style={{ border: `1px solid ${chat.ratings[i] === 'down' ? '#D90000' : 'var(--border)'}`, color: chat.ratings[i] === 'down' ? '#D90000' : 'var(--text-muted)' }}>{chat.ratings[i] === 'down' ? 'Pouce bas' : 'Pouce haut'}</span>}
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
      )}
    </>
  )
}
