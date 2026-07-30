'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { listQuotes, markQuoteRead, deleteQuote } from '@/actions/quotes'
import type { AdminQuote } from '@/actions/quotes'

const QuoteView = dynamic(() => import('@/components/chat/QuoteView'), { ssr: false })

type Filter = 'tous' | 'unread' | 'read'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

export default function AdminQuotes() {
  const [quotes, setQuotes]     = useState<AdminQuote[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<Filter>('tous')
  const [selected, setSelected] = useState<AdminQuote | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setQuotes(await listQuotes()) } finally { setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (filter === 'unread') return quotes.filter((q) => !q.read)
    if (filter === 'read')   return quotes.filter((q) => q.read)
    return quotes
  }, [quotes, filter])

  const unreadCount = useMemo(() => quotes.filter((q) => !q.read).length, [quotes])
  const totalTTC = useMemo(() => quotes.reduce((sum, q) => sum + q.totalTTC, 0), [quotes])

  const handleOpen = async (q: AdminQuote) => {
    setSelected(q)
    if (!q.read) {
      await markQuoteRead(q.id)
      setQuotes((prev) => prev.map((x) => x.id === q.id ? { ...x, read: true } : x))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce devis ?')) return
    setDeleting(id)
    try {
      await deleteQuote(id)
      setQuotes((prev) => prev.filter((q) => q.id !== id))
      if (selected?.id === id) setSelected(null)
    } finally { setDeleting(null) }
  }

  const TABS: { id: Filter; label: string }[] = [
    { id: 'tous',   label: `Tous (${quotes.length})` },
    { id: 'unread', label: `Non lus (${unreadCount})` },
    { id: 'read',   label: `Lus` },
  ]

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>
          Devis générés par le chatbot
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {unreadCount > 0
            ? `${unreadCount} devis non lu${unreadCount > 1 ? 's' : ''}`
            : 'Aucun nouveau devis'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: quotes.length, color: 'var(--text)' },
          { label: 'Non lus', value: unreadCount, color: '#8B5CF6' },
          { label: 'Lus', value: quotes.length - unreadCount, color: '#10B981' },
          { label: 'Montant total', value: fmt(totalTTC), color: 'var(--text)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card no-lift p-4 text-center">
            <p className="text-xl font-display font-bold truncate" style={{ color }}>{value}</p>
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
                layoutId="quotes-tab"
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
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
          </svg>
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucun devis</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {filter === 'unread' ? 'Tous les devis ont été consultés.' : 'Aucun devis généré pour le moment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.03 }}
              className="card no-lift admin-row cursor-pointer flex items-center gap-4 p-4"
              onClick={() => handleOpen(q)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleOpen(q)}
            >
              {/* Unread dot */}
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: q.read ? 'transparent' : 'var(--accent)', border: q.read ? '1.5px solid var(--border)' : 'none' }} />

              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ background: 'var(--accent-glow)', color: 'var(--accent)', fontFamily: 'var(--font-space-grotesk)' }}
                aria-hidden="true"
              >
                {q.clientNom.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <p className="text-sm font-semibold truncate" style={{ color: q.read ? 'var(--text-muted)' : 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>
                    {q.clientNom}
                  </p>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                    {q.numero}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: q.read ? 'var(--text-subtle)' : 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                  <span className="font-medium">{fmt(q.totalTTC)}</span>
                  {' · '}
                  {q.descriptionProjet.slice(0, 70)}{q.descriptionProjet.length > 70 ? '…' : ''}
                </p>
              </div>

              {/* Date + delete */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <p className="text-xs hidden sm:block" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  {formatDate(q.createdAt)}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(q.id) }}
                  disabled={deleting === q.id}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
                  style={{ color: 'var(--text-subtle)' }}
                  title="Supprimer"
                  aria-label="Supprimer le devis"
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

      {selected && <QuoteView quote={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
