'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { getMonthSlots, getDaySlots, bookMeeting, type Booking } from '@/actions/bookings'
import MonthGrid, { type DayStatus } from '@/components/calendar/MonthGrid'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarPage() {
  const locale = useLocale()
  const t = useDictionary()
  const tc = t.calendar

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [monthSlots, setMonthSlots] = useState<Record<string, string[]>>({})
  const [loadingMonth, setLoadingMonth] = useState(true)

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [daySlots, setDaySlots] = useState<string[] | null>(null)
  const [loadingDay, setLoadingDay] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [form, setForm] = useState({ clientNom: '', clientEmail: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingMonth(true) // eslint-disable-line react-hooks/set-state-in-effect
    getMonthSlots(year, month)
      .then((m) => { if (!cancelled) setMonthSlots(m) })
      .finally(() => { if (!cancelled) setLoadingMonth(false) })
    return () => { cancelled = true }
  }, [year, month])

  const dayStatus = useMemo(() => {
    const map: Record<string, DayStatus> = {}
    for (const [date, slots] of Object.entries(monthSlots)) {
      if (slots.length > 0) map[date] = 'available'
    }
    return map
  }, [monthSlots])

  const selectDay = useCallback((dateISO: string) => {
    setSelectedDay(dateISO)
    setSelectedSlot(null)
    setBooking(null)
    setError(null)
    setLoadingDay(true)
    getDaySlots(dateISO)
      .then(setDaySlots)
      .finally(() => setLoadingDay(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDay || !selectedSlot) return
    setSubmitting(true)
    setError(null)
    try {
      const start = new Date(`${selectedDay}T${selectedSlot}:00+01:00`).toISOString()
      const result = await bookMeeting({ ...form, start })
      setBooking(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : tc.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  const dayLabel = selectedDay
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selectedDay}T12:00:00`))
    : ''

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
      <FadeIn>
        <p className="section-label mb-3">{tc.label}</p>
        <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>{tc.title}</h1>
        <p className="text-lg mb-12" style={{ color: 'var(--text-muted)', maxWidth: 560 }}>{tc.subtitle}</p>
      </FadeIn>

      <div className="grid lg:grid-cols-[1fr,360px] gap-6 items-start">
        <FadeIn delay={0.05}>
          <div style={{ opacity: loadingMonth ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
            <MonthGrid
              year={year} month={month}
              onNavigate={(y, m) => { setYear(y); setMonth(m) }}
              selected={selectedDay}
              onSelectDate={selectDay}
              dayStatus={dayStatus}
              todayISO={todayISO()}
              disablePast
              locale={locale}
            />
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="card p-5" style={{ minHeight: 320 }}>
            <AnimatePresence mode="wait">
              {booking ? (
                <motion.div key="confirmed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--accent-glow)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <p className="font-display font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>{tc.confirmedTitle}</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{tc.confirmedBody}</p>
                  <div className="p-3 rounded-lg" style={{ background: 'var(--surface)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{tc.accessCodeLabel}</p>
                    <p className="font-display font-bold text-lg tracking-widest" style={{ color: 'var(--text)' }}>{booking.accessCode}</p>
                  </div>
                </motion.div>
              ) : !selectedDay ? (
                <motion.p key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                  {tc.pickDay}
                </motion.p>
              ) : (
                <motion.div key={selectedDay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="font-display font-semibold capitalize mb-3" style={{ color: 'var(--text)' }}>{dayLabel}</p>

                  {loadingDay ? (
                    <div className="flex flex-wrap gap-2">
                      {[...Array(6)].map((_, i) => <div key={i} className="animate-pulse rounded-lg" style={{ width: 64, height: 32, background: 'var(--surface)' }} />)}
                    </div>
                  ) : !daySlots?.length ? (
                    <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>{tc.noSlots}</p>
                  ) : !selectedSlot ? (
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((s) => (
                        <button key={s} onClick={() => setSelectedSlot(s)} className="btn-secondary btn-sm" style={{ padding: '0.4rem 0.9rem' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <button type="button" onClick={() => setSelectedSlot(null)} className="text-xs mb-1 hover:underline" style={{ color: 'var(--accent)' }}>
                        ← {selectedSlot}
                      </button>
                      <input required value={form.clientNom} onChange={(e) => setForm((p) => ({ ...p, clientNom: e.target.value }))} placeholder={tc.namePlaceholder} className="input text-sm" />
                      <input required type="email" value={form.clientEmail} onChange={(e) => setForm((p) => ({ ...p, clientEmail: e.target.value }))} placeholder={tc.emailPlaceholder} className="input text-sm" />
                      <textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder={tc.messagePlaceholder} rows={3} className="input text-sm" style={{ resize: 'vertical' }} />
                      {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
                      <button type="submit" disabled={submitting} className="btn-primary w-full justify-center text-sm">
                        {submitting ? tc.booking : tc.confirm}
                      </button>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
