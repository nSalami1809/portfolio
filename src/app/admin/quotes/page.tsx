'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { m } from 'framer-motion'
import { listQuotes, markQuoteRead, deleteQuote, updateQuoteStatus, requestTestimonial } from '@/actions/quotes'
import type { AdminQuote, QuoteStatus } from '@/actions/quotes'
import { listInvoices } from '@/actions/billing'
import type { Invoice } from '@/lib/invoicing'
import QuoteWorkflowPanel from '@/components/admin/QuoteWorkflowPanel'
import QuotePipeline from '@/components/admin/QuotePipeline'
import { getQuoteReminderHistory } from '@/actions/assistant'
import type { ReminderHistoryEntry } from '@/lib/assistant/reminders'
import { useToast } from '@/components/admin/Toast'
import Icon from '@/components/ui/Icon'

const QuoteView = dynamic(() => import('@/components/chat/QuoteView'), { ssr: false })

type Filter = 'tous' | 'unread' | 'read' | 'pending' | 'accepted' | 'declined' | 'delivered' | 'unpaid'

const PAGE_SIZE = 50

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

const STATUS_LABEL: Record<QuoteStatus, string> = { pending: 'En attente', accepted: 'Accepté', declined: 'Refusé' }
const STATUS_COLOR: Record<QuoteStatus, string> = { pending: 'var(--text-subtle)', accepted: '#008000', declined: '#D90000' }

const EVENT_LABEL: Record<string, string> = {
  created: 'Devis créé',
  viewed: 'Devis consulté par le client',
  signed: 'Devis signé électroniquement',
  declined: 'Devis refusé par le client',
  status_changed: 'Statut modifié manuellement',
  delay_changed: 'Délai de réalisation ajusté',
  delivered: 'Projet livré — procès-verbal envoyé',
  delivery_accepted: 'Procès-verbal de recette signé par le client',
  avenant_created: 'Avenant créé',
  invoice_issued: 'Facture émise',
  invoice_paid: 'Facture payée — reçu émis',
  invoice_cancelled: 'Facture annulée',
  reminder_sent: 'Relance automatique envoyée',
  delivery_deemed: 'Recette réputée acceptée (aucun retour du client)',
  revision_requested: 'Demande de modification',
  file_uploaded: 'Fichier envoyé par le client',
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminQuotes() {
  const toast = useToast()
  const [quotes, setQuotes]     = useState<AdminQuote[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<Filter>('tous')
  const [selected, setSelected] = useState<AdminQuote | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  // List (default) or pipeline by stage, kept in the address (?vue=pipeline) so it can be linked.
  const [view, setView] = useState<'list' | 'pipeline'>('list')
  const [reminders, setReminders] = useState<Record<string, ReminderHistoryEntry>>({})
  const changeView = (next: 'list' | 'pipeline') => {
    setView(next)
    const url = new URL(window.location.href)
    if (next === 'pipeline') url.searchParams.set('vue', 'pipeline')
    else url.searchParams.delete('vue')
    window.history.replaceState(null, '', url)
  }

  // `silent` refreshes in place (after an action in a row's panel) instead of
  // swapping the whole list for skeletons and collapsing the open panel.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [q, inv, rem] = await Promise.all([listQuotes(), listInvoices(), getQuoteReminderHistory().catch(() => ({}))])
      setQuotes(q)
      setInvoices(inv)
      setReminders(rem)
    } finally { if (!silent) setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // A link from the invoices page (?q=DEV-2026-001) opens the list already searched.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) setSearch(q) // eslint-disable-line react-hooks/set-state-in-effect
    if (params.get('vue') === 'pipeline') setView('pipeline')
  }, [])

  // Quotes that still have an unpaid invoice behind them.
  const unpaidNumeros = useMemo(
    () => new Set(invoices.filter((i) => i.status === 'issued').map((i) => i.quoteNumero)),
    [invoices],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return quotes.filter((q) => {
      if (filter === 'unread' && q.read) return false
      if (filter === 'read' && !q.read) return false
      if (filter === 'pending' && q.status !== 'pending') return false
      if (filter === 'accepted' && q.status !== 'accepted') return false
      if (filter === 'declined' && q.status !== 'declined') return false
      if (filter === 'delivered' && !q.delivery) return false
      if (filter === 'unpaid' && !unpaidNumeros.has(q.numero)) return false
      if (!needle) return true
      return [q.numero, q.clientNom, q.clientSociete ?? '', q.clientEmail ?? '', q.clientTelephone ?? '', q.accessCode, q.descriptionProjet]
        .some((v) => v.toLowerCase().includes(needle))
    })
  }, [quotes, filter, search, unpaidNumeros])

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
    // Signed quotes are locked server-side — revert the optimistic update
    // rather than leave the UI showing a status that was never saved.
    const revert = (message: string) => {
      setQuotes((prev) => prev.map((x) => x.id === id && previous ? { ...x, status: previous } : x))
      toast(message, 'error')
    }
    try {
      const result = await updateQuoteStatus(id, status)
      if (!result.ok) revert(result.message)
    } catch {
      revert('Impossible de modifier ce devis.')
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
      const result = await deleteQuote(id)
      if (!result.ok) {
        toast(result.message, 'error')
        return
      }
      setQuotes((prev) => prev.filter((q) => q.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch {
      toast('Suppression impossible.', 'error')
    } finally { setDeleting(null) }
  }

  const TABS: { id: Filter; label: string }[] = [
    { id: 'tous',   label: `Tous (${quotes.length})` },
    { id: 'unread', label: `Non lus (${unreadCount})` },
    { id: 'read',   label: `Lus` },
    { id: 'pending',   label: `En attente (${quotes.filter((x) => x.status === 'pending').length})` },
    { id: 'accepted',  label: `Acceptés (${quotes.filter((x) => x.status === 'accepted').length})` },
    { id: 'declined',  label: `Refusés (${quotes.filter((x) => x.status === 'declined').length})` },
    { id: 'delivered', label: `Livrés (${quotes.filter((x) => !!x.delivery).length})` },
    { id: 'unpaid',    label: `Impayés (${unpaidNumeros.size})` },
  ]

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>
            Devis générés par le chatbot
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {unreadCount > 0
              ? `${unreadCount} devis non lu${unreadCount > 1 ? 's' : ''}`
              : 'Aucun nouveau devis'}
          </p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Affichage des devis">
          <button type="button" aria-pressed={view === 'list'} className={view === 'list' ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'} onClick={() => changeView('list')}>Liste</button>
          <button type="button" aria-pressed={view === 'pipeline'} className={view === 'pipeline' ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'} onClick={() => changeView('pipeline')}>Pipeline</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: quotes.length, color: 'var(--text)' },
          { label: 'Non lus', value: unreadCount, color: '#E45742' },
          { label: 'Lus', value: quotes.length - unreadCount, color: '#008000' },
          { label: 'Montant total', value: fmt(totalTTC), color: 'var(--text)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card no-lift p-4 text-center">
            <p className="text-xl font-display font-bold truncate" style={{ color }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>{label}</p>
          </div>
        ))}
      </div>

      {view === 'pipeline' && !loading && (
        <QuotePipeline
          quotes={quotes}
          unpaid={unpaidNumeros}
          reminders={reminders}
          onOpen={(q) => { setFilter('tous'); setSearch(q.numero); setExpandedId(q.id); changeView('list') }}
        />
      )}
      {view === 'pipeline' && loading && <div className="card no-lift p-4 animate-pulse" style={{ height: 160 }} />}

      {view === 'list' && (<>
      {/* Filter tabs */}
      <div className="flex gap-0 mb-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => { setFilter(id); setVisible(PAGE_SIZE) }}
            className="relative px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors whitespace-nowrap"
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
          onClick={() => load()}
          className="ml-auto mb-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
          title="Rafraîchir"
        >
          <Icon name="refresh" size={12} />
          Actualiser
        </button>
      </div>

      <input
        className="input mb-4"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setVisible(PAGE_SIZE) }}
        placeholder="Rechercher : numéro, client, société, email, téléphone, code de suivi…"
        aria-label="Rechercher un devis"
      />

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card no-lift p-4 animate-pulse" style={{ height: '72px' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card no-lift p-12 text-center">
          <Icon name="documents" size={28} className="mx-auto mb-3" style={{ color: 'var(--text-subtle)' }} />
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucun devis</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {search || filter !== 'tous' ? 'Aucun devis ne correspond à cette recherche.' : 'Aucun devis généré pour le moment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, visible).map((q, i) => (
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
              <div className="w-2 h-2 flex-shrink-0" style={{ background: q.read ? 'transparent' : 'var(--accent)', border: q.read ? '1.5px solid var(--border)' : 'none' }} />

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
                    {q.numero}{q.kind === 'avenant' && q.parentNumero ? ` · avenant à ${q.parentNumero}` : ''}
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
                  <Icon name="copy" size={13} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === q.id ? null : q.id) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-subtle)' }}
                  title="Historique"
                  aria-label={`Historique du devis ${q.numero}`}
                  aria-expanded={expandedId === q.id}
                >
                  <Icon name="chevronDown" size={13} style={{ transform: expandedId === q.id ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }} />
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
                  <Icon name="trash" size={13} />
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
                <QuoteWorkflowPanel quote={q} invoices={invoices} onChanged={() => load(true)} notify={toast} />
              </div>
            )}
          </div>
          ))}
          {filtered.length > visible && (
            <div className="pt-2 text-center">
              <button className="btn-secondary btn-sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Afficher plus ({filtered.length - visible} restant{filtered.length - visible > 1 ? 's' : ''})
              </button>
            </div>
          )}
        </div>
      )}

      </>)}

      {selected && <QuoteView quote={selected} onClose={() => setSelected(null)} variant={selected.status === 'accepted' ? 'contrat' : 'devis'} />}
    </>
  )
}
