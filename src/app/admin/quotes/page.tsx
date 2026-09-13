'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { m } from 'framer-motion'
import { listQuotes, markQuoteRead, deleteQuote, updateQuoteStatus, requestTestimonial } from '@/actions/quotes'
import type { AdminQuote, QuoteStatus } from '@/actions/quotes'
import { useToast } from '@/components/admin/Toast'

const QuoteView = dynamic(() => import('@/components/chat/QuoteView'), { ssr: false })

type Filter = 'tous' | 'unread' | 'read'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

const STATUS_LABEL: Record<QuoteStatus, string> = { pending: 'En attente', accepted: 'Accepté', declined: 'Refusé' }
const STATUS_COLOR: Record<QuoteStatus, string> = { pending: 'var(--text-subtle)', accepted: '#008000', declined: '#EF4444' }

const EVENT_LABEL: Record<string, string> = {
  created: 'Devis créé',
  viewed: 'Devis consulté par le client',
  signed: 'Devis signé électroniquement',
  declined: 'Devis refusé par le client',
  status_changed: 'Statut modifié manuellement',
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminQuotes() {
  const toast = useToast()
  const [quotes, setQuotes]     = useState<AdminQuote[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<Filter>('tous')
  const [selected, setSelected] = useState<AdminQuote | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  const handleStatusChange = async (id: string, status: QuoteStatus) => {
    const previous = quotes.find((x) => x.id === id)?.status
    setQuotes((prev) => prev.map((x) => x.id === id ? { ...x, status } : x))
    try {
      await updateQuoteStatus(id, status)
    } catch (e) {
      // Signed quotes are locked server-side — revert the optimistic update
      // rather than leave the UI showing a status that was never saved.
      setQuotes((prev) => prev.map((x) => x.id === id && previous ? { ...x, status: previous } : x))
      toast(e instanceof Error ? e.message : 'Impossible de modifier ce devis.', 'error')
    }
  }

  const handleCopySignLink = async (q: AdminQuote) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const url = `${siteUrl}/fr/devis/signature/${q.signToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Lien de signature copié')
    } catch {
      toast('Impossible de copier le lien', 'error')
    }
  }

  const handleRequestTestimonial = async (q: AdminQuote) => {
    setRequesting(q.id)
    try {
      const result = await requestTestimonial(q.id)
      if (result.ok) {
        setQuotes((prev) => prev.map((x) => x.id === q.id ? { ...x, testimonialRequestedAt: new Date().toISOString() } : x))
      }
      toast(result.message, result.ok ? undefined : 'error')
    } finally {
      setRequesting(null)
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
          { label: 'Lus', value: quotes.length - unreadCount, color: '#008000' },
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
              <m.div
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
          <div key={q.id}>
            <m.div
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

              {/* Date + status + delete */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <p className="text-xs hidden sm:block" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  {formatDate(q.createdAt)}
                </p>
                {q.signature ? (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 flex-shrink-0"
                    style={{ background: 'rgba(0,128,0,0.1)', color: '#008000', border: '1px solid rgba(0,128,0,0.3)' }}
                    title={`Signé électroniquement par ${q.signature.name}`}
                  >
                    🟢 Signé
                  </span>
                ) : (
                  <select
                    value={q.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleStatusChange(q.id, e.target.value as QuoteStatus)}
                    className="input text-xs"
                    style={{ width: 'auto', padding: '0.35rem 1.75rem 0.35rem 0.6rem', color: STATUS_COLOR[q.status], fontWeight: 600 }}
                    aria-label={`Statut du devis ${q.numero}`}
                  >
                    {(Object.keys(STATUS_LABEL) as QuoteStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopySignLink(q) }}
                  className="w-7 h-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)] hidden sm:flex"
                  style={{ color: 'var(--text-subtle)' }}
                  title="Copier le lien de signature"
                  aria-label={`Copier le lien de signature du devis ${q.numero}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === q.id ? null : q.id) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-subtle)' }}
                  title="Historique"
                  aria-label={`Historique du devis ${q.numero}`}
                  aria-expanded={expandedId === q.id}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expandedId === q.id ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }} aria-hidden="true">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {q.clientEmail && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRequestTestimonial(q) }}
                    disabled={requesting === q.id}
                    className="btn-secondary btn-xs hidden sm:inline-flex"
                    title={q.testimonialRequestedAt ? `Déjà envoyé le ${formatDate(q.testimonialRequestedAt)} — cliquer pour redemander` : 'Demander un avis au client'}
                  >
                    {q.testimonialRequestedAt ? 'Redemander un avis' : 'Demander un avis'}
                  </button>
                )}
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
            </m.div>

            {expandedId === q.id && (
              <div className="card no-lift p-4 mt-1" style={{ background: 'var(--bg-secondary)' }}>
                <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>Historique</p>
                {q.events.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Aucun événement enregistré.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {q.events.map((ev, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-3 text-xs">
                        <span style={{ color: 'var(--text)' }}>
                          {EVENT_LABEL[ev.type] ?? ev.type}
                          {ev.meta?.to && ` → ${STATUS_LABEL[ev.meta.to as QuoteStatus] ?? ev.meta.to}`}
                        </span>
                        <span style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{formatEventDate(ev.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          ))}
        </div>
      )}

      {selected && <QuoteView quote={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
