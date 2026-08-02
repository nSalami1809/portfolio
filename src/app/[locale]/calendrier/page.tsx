'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { getMonthSlots, getDaySchedule, bookMeeting, type Booking, type DaySlot } from '@/actions/bookings'
import { joinWaitlist } from '@/actions/waitlist'
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
  const [daySchedule, setDaySchedule] = useState<DaySlot[] | null>(null)
  const [loadingDay, setLoadingDay] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<DaySlot | null>(null)

  // Slots come back from the server as Africa/Libreville wall-clock times +
  // an absolute instant — displaying that instant in the visitor's own
  // browser timezone (no explicit `timeZone` option = runtime default)
  // avoids the "is 14:00 his time or mine?" confusion for remote clients.
  const visitorTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const formatLocalTime = useCallback(
    (iso: string) => new Date(iso).toLocaleTimeString(locale === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }),
    [locale],
  )

  const [form, setForm] = useState({ clientNom: '', clientEmail: '', clientTelephone: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)

  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null)

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
    setWaitlistEmail('')
    setWaitlistMessage(null)
    setLoadingDay(true)
    getDaySchedule(dateISO)
      .then(setDaySchedule)
      .finally(() => setLoadingDay(false))
  }, [])

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDay || !waitlistEmail.trim()) return
    setWaitlistSubmitting(true)
    try {
      const result = await joinWaitlist({ date: selectedDay, email: waitlistEmail.trim() })
      setWaitlistMessage(result.message)
    } catch {
      setWaitlistMessage(tc.genericError)
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await bookMeeting({ ...form, start: selectedSlot.iso })
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
                  <p className="font-display font-semibold capitalize mb-1" style={{ color: 'var(--text)' }}>{dayLabel}</p>
                  {!loadingDay && !!daySchedule?.length && (
                    <p className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>
                      {tc.timezoneNote(visitorTz)}
                    </p>
                  )}

                  {loadingDay ? (
                    <div className="flex flex-wrap gap-2">
                      {[...Array(6)].map((_, i) => <div key={i} className="animate-pulse rounded-lg" style={{ width: 64, height: 32, background: 'var(--surface)' }} />)}
                    </div>
                  ) : !daySchedule?.length ? (
                    <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>{tc.noSlots}</p>
                  ) : daySchedule.every((s) => !s.available) ? (
                    <div>
                      <p className="text-sm mb-3" style={{ color: 'var(--text-subtle)' }}>{tc.fullyBooked}</p>
                      {waitlistMessage ? (
                        <p className="text-sm" style={{ color: 'var(--accent)' }}>{waitlistMessage}</p>
                      ) : (
                        <form onSubmit={handleJoinWaitlist} className="space-y-2">
                          <input
                            required type="email" value={waitlistEmail}
                            onChange={(e) => setWaitlistEmail(e.target.value)}
                            placeholder={tc.emailPlaceholder} className="input text-sm"
                          />
                          <button type="submit" disabled={waitlistSubmitting} className="btn-secondary w-full justify-center text-sm">
                            {tc.joinWaitlist}
                          </button>
                        </form>
                      )}
                    </div>
                  ) : !selectedSlot ? (
                    <div className="flex flex-wrap gap-2">
                      {daySchedule.map((s) => (
                        <button
                          key={s.iso}
                          type="button"
                          disabled={!s.available}
                          onClick={() => setSelectedSlot(s)}
                          className="btn-secondary btn-sm"
                          style={{
                            padding: '0.4rem 0.9rem',
                            opacity: s.available ? 1 : 0.4,
                            textDecoration: s.available ? 'none' : 'line-through',
                            cursor: s.available ? 'pointer' : 'not-allowed',
                          }}
                          aria-label={s.available ? formatLocalTime(s.iso) : `${formatLocalTime(s.iso)} — ${tc.slotTaken}`}
                          title={s.available ? undefined : tc.slotTaken}
                        >
                          {formatLocalTime(s.iso)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <button type="button" onClick={() => setSelectedSlot(null)} className="text-xs mb-1 hover:underline" style={{ color: 'var(--accent)' }}>
                        ← {formatLocalTime(selectedSlot.iso)}
                      </button>
                      <input required value={form.clientNom} onChange={(e) => setForm((p) => ({ ...p, clientNom: e.target.value }))} placeholder={tc.namePlaceholder} className="input text-sm" />
                      <input required type="email" value={form.clientEmail} onChange={(e) => setForm((p) => ({ ...p, clientEmail: e.target.value }))} placeholder={tc.emailPlaceholder} className="input text-sm" />
                      <input type="tel" value={form.clientTelephone} onChange={(e) => setForm((p) => ({ ...p, clientTelephone: e.target.value }))} maxLength={30} placeholder={tc.phonePlaceholder} className="input text-sm" />
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
