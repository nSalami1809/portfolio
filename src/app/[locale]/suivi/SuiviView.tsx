'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import FadeIn from '@/components/animations/FadeIn'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { getProjectTracking, type ProjectTracking } from '@/actions/tracking'
import type { TrackState } from '@/lib/tracking-steps'

const STATE_COLOR: Record<TrackState, string> = {
  done: '#008000',
  current: 'var(--accent)',
  pending: 'var(--text-subtle)',
  blocked: '#D90000',
}

function StepMark({ state }: { state: TrackState }) {
  const color = STATE_COLOR[state]
  return (
    <span
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: 28, height: 28, border: `1.5px solid ${color}`, background: state === 'done' ? color : 'transparent', color: state === 'done' ? '#fff' : color }}
      aria-hidden="true"
    >
      {state === 'done' && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      )}
      {state === 'blocked' && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      )}
      {state === 'current' && <span className="block" style={{ width: 8, height: 8, background: color }} />}
    </span>
  )
}

export default function SuiviView() {
  const locale = useLocale()
  const dict = useDictionary()
  const t = dict.track

  const [code, setCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [tracking, setTracking] = useState<ProjectTracking | null>(null)

  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR'
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })

  const run = async (raw: string) => {
    const value = raw.trim()
    if (!value) { setError(t.invalid); return }
    setSearching(true)
    setError('')
    try {
      const result = await getProjectTracking(value, locale)
      if (result.ok) {
        setTracking(result.tracking)
        // Keep the code in the address so the page can be bookmarked or re-shared.
        window.history.replaceState(null, '', `?ref=${encodeURIComponent(value.toUpperCase())}`)
      } else {
        setTracking(null)
        setError(result.error === 'notfound' ? t.notFound : result.error === 'rate' ? t.rate : result.error === 'invalid' ? t.invalid : t.generic)
      }
    } catch {
      setTracking(null)
      setError(t.generic)
    } finally {
      setSearching(false)
    }
  }

  // A link with ?ref=CODE (from an email, or a bookmark) opens straight on the project.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from the ?ref= link
      setCode(ref)
      run(ref)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasAction = !!tracking && (!!tracking.links.signPath || !!tracking.links.pvPath)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <FadeIn>
        <p className="section-label mb-3">{t.label}</p>
        <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.2rem,5.5vw,3.5rem)' }}>{t.title}</h1>
        <p className="text-lg mb-10" style={{ color: 'var(--text-muted)', maxWidth: 560 }}>{t.subtitle}</p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <form
          className="card no-lift p-5 mb-8 flex gap-2 flex-wrap"
          onSubmit={(e) => { e.preventDefault(); run(code) }}
        >
          <label htmlFor="track-code" className="sr-only">{t.placeholder}</label>
          <input
            id="track-code"
            className="input"
            style={{ flex: '1 1 220px', textTransform: 'uppercase', letterSpacing: '0.08em' }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t.placeholder}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
          />
          <button type="submit" disabled={searching} className="btn-primary flex-shrink-0">
            {searching ? t.searching : t.button}
          </button>
        </form>
      </FadeIn>

      {error && (
        <p className="text-sm px-4 py-3 mb-8" role="alert" style={{ background: 'rgba(217,0,0,0.1)', color: '#D90000', border: '1px solid rgba(217,0,0,0.25)' }}>{error}</p>
      )}

      {tracking && (
        <FadeIn>
          <div className="card no-lift p-6 sm:p-8 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <p className="section-label mb-1">{tracking.kind === 'avenant' ? t.avenantLabel : t.devisLabel} {tracking.numero}</p>
                <p className="font-display font-semibold text-lg" style={{ color: 'var(--text)' }}>{tracking.clientNom}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{t.totalLabel}</p>
                <p className="font-display font-bold text-xl" style={{ color: 'var(--accent)' }}>{tracking.totalTTC.toLocaleString(dateLocale)} FCFA</p>
              </div>
            </div>

            <ol className="list-none p-0 m-0">
              {tracking.steps.map((step, i) => {
                const { label, detail } = t.describeStep(step.key, step.state, {
                  outcome: step.data?.outcome,
                  days: step.data?.days,
                  until: step.data?.until ? formatDate(step.data.until) : undefined,
                })
                const last = i === tracking.steps.length - 1
                return (
                  <li key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <StepMark state={step.state} />
                      {!last && <span className="flex-1 my-1" style={{ width: 1.5, minHeight: 18, background: step.state === 'done' ? '#008000' : 'var(--border)' }} aria-hidden="true" />}
                    </div>
                    <div className="pb-5 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: step.state === 'pending' ? 'var(--text-muted)' : 'var(--text)' }}>
                        {label}
                        <span className="ml-2 text-xs font-medium" style={{ color: STATE_COLOR[step.state] }}>{t.states[step.state]}</span>
                      </p>
                      {step.at && step.state === 'done' && <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{formatDate(step.at)}</p>}
                      {detail && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{detail}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="card no-lift p-6 mb-6">
            <p className="section-label mb-4">{t.actionsTitle}</p>
            {!hasAction && <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{t.nothingToDo}</p>}
            <div className="flex flex-wrap gap-3">
              {tracking.links.signPath && <Link href={tracking.links.signPath} className="btn-primary btn-sm">{t.signCta}</Link>}
              {tracking.links.pvPath && <Link href={tracking.links.pvPath} className="btn-primary btn-sm">{t.pvCta}</Link>}
              <Link href={tracking.links.documentPath} className="btn-secondary btn-sm">{t.docCta}</Link>
            </div>
          </div>

          {tracking.avenants.length > 0 && (
            <div className="card no-lift p-6">
              <p className="section-label mb-4">{t.avenantsTitle}</p>
              <ul className="space-y-3">
                {tracking.avenants.map((a) => (
                  <li key={a.numero} className="flex items-center justify-between gap-3 flex-wrap text-sm">
                    <span style={{ color: 'var(--text)' }}>
                      <strong>{a.numero}</strong> · {a.totalTTC.toLocaleString(dateLocale)} FCFA · <span style={{ color: 'var(--text-muted)' }}>{t.avenantStatus[a.status]}</span>
                    </span>
                    <button className="btn-secondary btn-xs" onClick={() => { setCode(a.code); run(a.code) }}>{t.followAvenant}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </FadeIn>
      )}
    </div>
  )
}
