'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import { listBookings, markBookingRead, adminCancelBooking, deleteBooking } from '@/actions/bookings'
import type { AdminBooking } from '@/actions/bookings'
import type { WeeklyHours } from '@/types'
import MonthGrid, { type DayStatus } from '@/components/calendar/MonthGrid'

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type Tab = 'calendrier' | 'rendezvous' | 'disponibilites'

export default function AdminCalendar() {
  const { data, updateAvailability } = usePortfolio()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('calendrier')

  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { setBookings(await listBookings()) } finally { setLoading(false) }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const dayStatus = useMemo(() => {
    const map: Record<string, DayStatus> = {}
    for (const d of data.availability.blackoutDates) map[d] = 'blocked'
    for (const b of bookings) {
      if (b.status !== 'confirmed') continue
      const iso = b.start.slice(0, 10)
      if (!map[iso]) map[iso] = 'booked'
    }
    return map
  }, [bookings, data.availability.blackoutDates])

  const dayBookings = useMemo(
    () => selectedDay ? bookings.filter((b) => b.start.slice(0, 10) === selectedDay && b.status === 'confirmed') : [],
    [bookings, selectedDay],
  )
  const isBlocked = selectedDay ? data.availability.blackoutDates.includes(selectedDay) : false

  const toggleBlackout = (dateISO: string) => {
    const set = new Set(data.availability.blackoutDates)
    if (set.has(dateISO)) set.delete(dateISO); else set.add(dateISO)
    updateAvailability({ ...data.availability, blackoutDates: Array.from(set).sort() })
    toast(set.has(dateISO) ? 'Journée bloquée' : 'Journée débloquée')
  }

  const handleOpen = async (b: AdminBooking) => {
    if (!b.read) {
      await markBookingRead(b.id)
      setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, read: true } : x))
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Annuler ce rendez-vous ?')) return
    await adminCancelBooking(id)
    setBookings((prev) => prev.map((x) => x.id === id ? { ...x, status: 'cancelled' } : x))
    toast('Rendez-vous annulé', 'error')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement ce rendez-vous ?')) return
    await deleteBooking(id)
    setBookings((prev) => prev.filter((x) => x.id !== id))
    toast('Rendez-vous supprimé', 'error')
  }

  const upcoming = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed' && b.start >= new Date().toISOString()),
    [bookings],
  )
  const unreadCount = useMemo(() => bookings.filter((b) => !b.read).length, [bookings])

  const setHours = (day: number, patch: Partial<WeeklyHours>) => {
    updateAvailability({
      ...data.availability,
      weeklyHours: data.availability.weeklyHours.map((h) => h.day === day ? { ...h, ...patch } : h),
    })
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'calendrier', label: 'Calendrier' },
    { id: 'rendezvous', label: `Rendez-vous (${upcoming.length})` },
    { id: 'disponibilites', label: 'Disponibilités' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>Calendrier</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {unreadCount > 0 ? `${unreadCount} rendez-vous non lu${unreadCount > 1 ? 's' : ''}` : 'Aucun nouveau rendez-vous'}
        </p>
      </div>

      <div className="flex gap-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="relative px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors"
            style={{ fontFamily: 'var(--font-poppins)', color: tab === id ? 'var(--text)' : 'var(--text-subtle)', background: 'transparent', border: 'none' }}
          >
            {label}
            {tab === id && (
              <motion.div layoutId="cal-tab" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ background: 'var(--accent)' }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
            )}
          </button>
        ))}
      </div>

      {tab === 'calendrier' && (
        <div className="grid lg:grid-cols-[1fr,280px] gap-4 items-start">
          <MonthGrid
            year={year} month={month}
            onNavigate={(y, m) => { setYear(y); setMonth(m) }}
            selected={selectedDay}
            onSelectDate={setSelectedDay}
            dayStatus={dayStatus}
            todayISO={todayISO()}
            headerAction={
              selectedDay ? (
                <button onClick={() => toggleBlackout(selectedDay)} className={isBlocked ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}>
                  {isBlocked ? 'Débloquer ce jour' : 'Bloquer ce jour'}
                </button>
              ) : undefined
            }
          />

          <div className="card no-lift p-4">
            {!selectedDay ? (
              <p className="text-sm" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>Sélectionnez un jour pour voir le détail.</p>
            ) : (
              <>
                <p className="font-display font-semibold mb-3" style={{ color: 'var(--text)' }}>{formatDateTime(`${selectedDay}T12:00:00`).split(' ').slice(0, 3).join(' ')}</p>
                {isBlocked && (
                  <p className="text-xs mb-3 px-2 py-1 rounded-lg inline-block" style={{ background: 'var(--surface-hover)', color: 'var(--text-subtle)' }}>Journée bloquée</p>
                )}
                {dayBookings.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>Aucun rendez-vous ce jour.</p>
                ) : (
                  <div className="space-y-2">
                    {dayBookings.map((b) => (
                      <div key={b.id} className="p-2.5 rounded-lg text-xs" style={{ background: 'var(--surface-hover)' }}>
                        <p className="font-semibold" style={{ color: 'var(--text)' }}>{new Date(b.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Libreville' })} — {b.clientNom}</p>
                        <p style={{ color: 'var(--text-subtle)' }}>{b.clientEmail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'rendezvous' && (
        loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="card no-lift p-4 animate-pulse" style={{ height: '72px' }} />)}</div>
        ) : bookings.length === 0 ? (
          <div className="card no-lift p-12 text-center">
            <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucun rendez-vous</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>Les rendez-vous pris depuis le site ou le chatbot apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: i * 0.03 }}
                className="card no-lift admin-row cursor-pointer flex items-center gap-4 p-4"
                onClick={() => handleOpen(b)}
                role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleOpen(b)}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.read ? 'transparent' : 'var(--accent)', border: b.read ? '1.5px solid var(--border)' : 'none' }} />
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ background: 'var(--accent-glow)', color: 'var(--accent)', fontFamily: 'var(--font-space-grotesk)' }} aria-hidden="true">
                  {b.clientNom.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: b.read ? 'var(--text-muted)' : 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{b.clientNom}</p>
                    {b.status === 'cancelled' && <span className="tag text-xs">Annulé</span>}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{formatDateTime(b.start)} · {b.clientEmail}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {b.status === 'confirmed' && (
                    <button onClick={(e) => { e.stopPropagation(); handleCancel(b.id) }} className="btn-secondary btn-xs">Annuler</button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(b.id) }} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10" style={{ color: 'var(--text-subtle)' }} title="Supprimer" aria-label="Supprimer le rendez-vous">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {tab === 'disponibilites' && (
        <div className="space-y-4">
          <div className="card no-lift p-5">
            <p className="font-display font-semibold mb-4" style={{ color: 'var(--text)' }}>Horaires hebdomadaires</p>
            <div className="space-y-2.5">
              {data.availability.weeklyHours.map((h) => (
                <div key={h.day} className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 w-24 flex-shrink-0 cursor-pointer">
                    <input type="checkbox" checked={h.enabled} onChange={(e) => setHours(h.day, { enabled: e.target.checked })} className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
                    <span className="text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>{DAY_LABELS[h.day]}</span>
                  </label>
                  <input type="time" value={h.start} disabled={!h.enabled} onChange={(e) => setHours(h.day, { start: e.target.value })} className="input text-sm" style={{ width: '9rem', opacity: h.enabled ? 1 : 0.5 }} />
                  <span style={{ color: 'var(--text-subtle)' }}>–</span>
                  <input type="time" value={h.end} disabled={!h.enabled} onChange={(e) => setHours(h.day, { end: e.target.value })} className="input text-sm" style={{ width: '9rem', opacity: h.enabled ? 1 : 0.5 }} />
                </div>
              ))}
            </div>
          </div>

          <div className="card no-lift p-5 grid sm:grid-cols-3 gap-4">
            <div>
              <label className="field-label">Durée d&apos;un créneau (min)</label>
              <input type="number" min={15} step={15} value={data.availability.slotMinutes} onChange={(e) => updateAvailability({ ...data.availability, slotMinutes: Number(e.target.value) || 30 })} className="input text-sm" />
            </div>
            <div>
              <label className="field-label">Battement entre RDV (min)</label>
              <input type="number" min={0} step={5} value={data.availability.bufferMinutes} onChange={(e) => updateAvailability({ ...data.availability, bufferMinutes: Number(e.target.value) || 0 })} className="input text-sm" />
            </div>
            <div>
              <label className="field-label">Horizon de réservation (jours)</label>
              <input type="number" min={1} value={data.availability.bookingWindowDays} onChange={(e) => updateAvailability({ ...data.availability, bookingWindowDays: Number(e.target.value) || 30 })} className="input text-sm" />
            </div>
          </div>

          {data.availability.blackoutDates.length > 0 && (
            <div className="card no-lift p-5">
              <p className="font-display font-semibold mb-3" style={{ color: 'var(--text)' }}>Journées bloquées</p>
              <div className="flex flex-wrap gap-2">
                {data.availability.blackoutDates.map((d) => (
                  <button key={d} onClick={() => toggleBlackout(d)} className="tag text-xs" title="Cliquer pour débloquer">
                    {d} ✕
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
