'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listContacts, markContactRead, deleteContact } from '@/actions/contact'
import type { ContactMessage } from '@/actions/contact'

type Filter = 'tous' | 'unread' | 'read'

const SUBJECT_LABELS: Record<string, string> = {
  mission: 'Mission freelance',
  collaboration: 'Collaboration',
  conseil: 'Conseil technique',
  autre: 'Autre',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminContacts() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<Filter>('tous')
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setMessages(await listContacts()) } finally { setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (filter === 'unread') return messages.filter((m) => !m.read)
    if (filter === 'read')   return messages.filter((m) => m.read)
    return messages
  }, [messages, filter])

  const unreadCount = useMemo(() => messages.filter((m) => !m.read).length, [messages])

  const handleOpen = async (msg: ContactMessage) => {
    setSelected(msg)
    if (!msg.read) {
      await markContactRead(msg.id)
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, read: true } : m))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce message ?')) return
    setDeleting(id)
    try {
      await deleteContact(id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
      if (selected?.id === id) setSelected(null)
    } finally { setDeleting(null) }
  }

  const TABS: { id: Filter; label: string }[] = [
    { id: 'tous',   label: `Tous (${messages.length})` },
    { id: 'unread', label: `Non lus (${unreadCount})` },
    { id: 'read',   label: `Lus` },
  ]

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>
          Messages de contact
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {unreadCount > 0
            ? `${unreadCount} message${unreadCount > 1 ? 's' : ''} non lu${unreadCount > 1 ? 's' : ''}`
            : 'Aucun nouveau message'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: messages.length, color: 'var(--text)' },
          { label: 'Non lus', value: unreadCount, color: '#8B5CF6' },
          { label: 'Lus', value: messages.length - unreadCount, color: '#10B981' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card no-lift p-4 text-center">
            <p className="text-2xl font-display font-bold" style={{ color }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className="relative px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors"
            style={{
              fontFamily: 'var(--font-poppins)',
              color: filter === id ? 'var(--text)' : 'var(--text-subtle)',
              background: 'transparent',
              border: 'none',
            }}
          >
            {label}
            {filter === id && (
              <motion.div
                layoutId="contacts-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: 'var(--accent)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto mb-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
          title="Rafraîchir"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Actualiser
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card no-lift p-4 animate-pulse" style={{ height: '72px' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card no-lift p-12 text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3" style={{ color: 'var(--text-subtle)' }} aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucun message</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {filter === 'unread' ? 'Tous les messages ont été lus.' : 'Aucun message reçu pour le moment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.03 }}
              className="card no-lift admin-row cursor-pointer flex items-center gap-4 p-4"
              onClick={() => handleOpen(msg)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleOpen(msg)}
            >
              {/* Unread dot */}
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: msg.read ? 'transparent' : 'var(--accent)', border: msg.read ? '1.5px solid var(--border)' : 'none' }} />

              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ background: 'var(--accent-glow)', color: 'var(--accent)', fontFamily: 'var(--font-space-grotesk)' }}
                aria-hidden="true"
              >
                {msg.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <p className="text-sm font-semibold truncate" style={{ color: msg.read ? 'var(--text-muted)' : 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>
                    {msg.name}
                  </p>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                    {msg.email}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: msg.read ? 'var(--text-subtle)' : 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                  <span className="font-medium">
                    {msg.subject === 'autre' && msg.customSubject ? msg.customSubject : (SUBJECT_LABELS[msg.subject] ?? msg.subject)}
                  </span>
                  {' · '}
                  {msg.message.slice(0, 80)}{msg.message.length > 80 ? '…' : ''}
                </p>
              </div>

              {/* Date + delete */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <p className="text-xs hidden sm:block" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  {formatDate(msg.createdAt)}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(msg.id) }}
                  disabled={deleting === msg.id}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
                  style={{ color: 'var(--text-subtle)' }}
                  title="Supprimer"
                  aria-label="Supprimer le message"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Message modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
              onClick={() => setSelected(null)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                role="dialog"
                aria-modal="true"
                aria-label={`Message de ${selected.name}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: 'var(--accent-glow)', color: 'var(--accent)', fontFamily: 'var(--font-space-grotesk)' }}
                      aria-hidden="true"
                    >
                      {selected.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-display font-semibold" style={{ color: 'var(--text)' }}>{selected.name}</p>
                      <a
                        href={`mailto:${selected.email}`}
                        className="text-xs hover:underline"
                        style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selected.email}
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="Fermer"
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-hover)] flex-shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* Meta */}
                <div className="px-6 pt-5 pb-3 flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-secondary)' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                      {selected.subject === 'autre' && selected.customSubject
                        ? selected.customSubject
                        : (SUBJECT_LABELS[selected.subject] ?? selected.subject)}
                    </span>
                  </div>
                  {selected.phone && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-secondary)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      </div>
                      <a href={`tel:${selected.phone}`} className="text-xs hover:underline" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>
                        {selected.phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-secondary)' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                      {formatDate(selected.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Message body */}
                <div className="px-6 pb-5">
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                      {selected.message}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 px-6 pb-6">
                  <a
                    href={`mailto:${selected.email}?subject=Re: ${selected.subject === 'autre' && selected.customSubject ? selected.customSubject : (SUBJECT_LABELS[selected.subject] ?? selected.subject)}`}
                    className="btn-primary btn-sm flex-1 justify-center"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Répondre
                  </a>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    disabled={deleting === selected.id}
                    className="btn-secondary btn-sm px-4 flex items-center gap-1.5"
                    style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.25)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
