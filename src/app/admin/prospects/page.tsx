'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listQuotes } from '@/actions/quotes'
import type { AdminQuote } from '@/actions/quotes'
import { listContacts } from '@/actions/contact'
import type { ContactMessage } from '@/actions/contact'
import { listBookings } from '@/actions/bookings'
import type { AdminBooking } from '@/actions/bookings'

type LeadEvent =
  | { type: 'contact'; date: string; data: ContactMessage }
  | { type: 'quote'; date: string; data: AdminQuote }
  | { type: 'booking'; date: string; data: AdminBooking }

interface Lead {
  email: string
  name: string
  events: LeadEvent[]
  lastActivity: string
}

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function buildLeads(contacts: ContactMessage[], quotes: AdminQuote[], bookings: AdminBooking[]): Lead[] {
  const map = new Map<string, Lead>()

  const touch = (rawEmail: string | undefined, name: string, event: LeadEvent) => {
    const key = rawEmail?.trim().toLowerCase()
    if (!key) return
    let lead = map.get(key)
    if (!lead) {
      lead = { email: key, name: name || key, events: [], lastActivity: event.date }
      map.set(key, lead)
    }
    lead.events.push(event)
    if (event.date > lead.lastActivity) lead.lastActivity = event.date
    if (name && lead.name === lead.email) lead.name = name
  }

  for (const c of contacts) touch(c.email, c.name, { type: 'contact', date: c.createdAt, data: c })
  for (const q of quotes) touch(q.clientEmail, q.clientNom, { type: 'quote', date: q.createdAt, data: q })
  for (const b of bookings) if (b.source === 'client') touch(b.clientEmail, b.clientNom, { type: 'booking', date: b.createdAt, data: b })

  return Array.from(map.values())
    .map((l) => ({ ...l, events: [...l.events].sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
}

const EVENT_ICON: Record<LeadEvent['type'], React.ReactNode> = {
  contact: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  quote: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>,
  booking: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
}

const EVENT_LABEL: Record<LeadEvent['type'], string> = { contact: 'Message', quote: 'Devis', booking: 'Rendez-vous' }

function eventSummary(e: LeadEvent): string {
  if (e.type === 'contact') return e.data.customSubject || e.data.subject
  if (e.type === 'quote') return `${e.data.numero} · ${fmt(e.data.totalTTC)} · ${e.data.status === 'accepted' ? 'Accepté' : e.data.status === 'declined' ? 'Refusé' : 'En attente'}`
  return `${new Date(e.data.start).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Libreville' })}${e.data.status === 'cancelled' ? ' · Annulé' : ''}`
}

export default function AdminProspects() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [contacts, quotes, bookings] = await Promise.all([listContacts(), listQuotes(), listBookings()])
      setLeads(buildLeads(contacts, quotes, bookings))
    } finally {
      setLoading(false)
    }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return leads
    return leads.filter((l) => l.name.toLowerCase().includes(q) || l.email.includes(q))
  }, [leads, search])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>Prospects</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {leads.length} contact{leads.length !== 1 ? 's' : ''} · messages, devis et rendez-vous regroupés par email
        </p>
      </div>

      <div className="relative" style={{ maxWidth: '380px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input className="input text-sm" style={{ paddingLeft: '2.25rem' }} placeholder="Rechercher un prospect…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un prospect" />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="card no-lift p-4 animate-pulse" style={{ height: '72px' }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card no-lift p-12 text-center">
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucun prospect</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {search ? 'Aucun résultat pour cette recherche.' : 'Les messages, devis et rendez-vous avec un email apparaîtront ici.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => {
            const isOpen = expanded === lead.email
            return (
              <div key={lead.email} className="card no-lift overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : lead.email)}
                  role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setExpanded(isOpen ? null : lead.email)}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ background: 'var(--accent-glow)', color: 'var(--accent)', fontFamily: 'var(--font-space-grotesk)' }} aria-hidden="true">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{lead.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{lead.email} · {lead.events.length} interaction{lead.events.length > 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-xs flex-shrink-0 hidden sm:block" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{formatDate(lead.lastActivity)}</p>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-subtle)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }} aria-hidden="true">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}
                    >
                      <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                        {lead.events.map((e, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-xs">
                            <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }} aria-hidden="true">
                              {EVENT_ICON[e.type]}
                            </span>
                            <div className="min-w-0">
                              <p style={{ color: 'var(--text)' }}>
                                <strong>{EVENT_LABEL[e.type]}</strong> · {formatDate(e.date)}
                              </p>
                              <p className="truncate" style={{ color: 'var(--text-subtle)' }}>{eventSummary(e)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
