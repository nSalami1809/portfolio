'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import WhatsAppButton from '@/components/ui/WhatsAppButton'
import type { Offer } from '@/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { BUDGETS, DELAYS, GOALS, describeAnswers, recommendOffers, type Answers, type Match } from '@/lib/offer-finder'

type Translated = Record<string, { title: string; description: string; features: string } | undefined>

const STEPS = ['goal', 'budget', 'delay'] as const
type Step = (typeof STEPS)[number]

const OPTIONS: Record<Step, readonly string[]> = { goal: GOALS, budget: BUDGETS, delay: DELAYS }

// Three questions about the visitor's project, then one advised offer taken from the site's real
// offers (see lib/offer-finder.ts). It runs in the browser from rules: no request to a model, nothing
// stored, nothing sent until the visitor chooses to ask for a quote or to write.
export default function OfferFinder({ offers, translated, t, locale, onRequestQuote, whatsappFor }: {
  offers: Offer[]
  translated: Translated
  t: Dictionary['finder']
  locale: string
  onRequestQuote: (title: string) => void
  /** The WhatsApp link for an advised offer ('' when none) and the visitor's answers ('' without a number). */
  whatsappFor: (title: string, summary: string) => string
}) {
  const [answers, setAnswers] = useState<Partial<Answers>>({})
  const [step, setStep] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const complete = (a: Partial<Answers>): a is Answers => Boolean(a.goal && a.budget && a.delay)
  const done = step >= STEPS.length && complete(answers)

  const choose = (key: Step, value: string) => {
    const next = { ...answers, [key]: value } as Partial<Answers>
    setAnswers(next)
    setStep((s) => s + 1)
    // the advice is announced to assistive technology, and read from its heading
    if (STEPS.indexOf(key) === STEPS.length - 1) requestAnimationFrame(() => headingRef.current?.focus())
  }
  const back = () => setStep((s) => Math.max(0, s - 1))
  const onOptionKey = (e: React.KeyboardEvent<HTMLInputElement>, key: Step, value: string) => {
    if (e.key === 'Enter') { e.preventDefault(); choose(key, value); return }
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const group = Array.from(e.currentTarget.closest('fieldset')?.querySelectorAll<HTMLInputElement>('input[type=radio]') ?? [])
    group[(group.indexOf(e.currentTarget) + delta + group.length) % group.length]?.focus()
  }
  const restart = () => { setAnswers({}); setStep(0) }

  const title = (o: Offer) => translated[o.id]?.title || o.title
  const description = (o: Offer) => translated[o.id]?.description || o.description
  const features = (o: Offer) => (translated[o.id] ? translated[o.id]!.features.split('\n').filter(Boolean) : (o.features ?? [])).slice(0, 3)

  const advice = done && complete(answers) ? recommendOffers(answers, offers) : null
  const summary = done && complete(answers)
    ? describeAnswers(answers, { goal: t.goal.options, budget: t.budget.options, delay: t.delay.options })
    : ''

  const reasons = (m: Match): string[] => [
    t.result.topic,
    m.budget === 'fits' ? t.result.budgetFits : m.budget === 'above' ? t.result.budgetAbove : m.budget === 'below' ? t.result.budgetBelow : t.result.budgetUnknown,
    ...(answers.delay === 'urgent' ? [t.result.urgent] : []),
  ]

  const current = STEPS[Math.min(step, STEPS.length - 1)]
  const question = t[current]

  return (
    <section id="trouver-mon-offre" className="card p-6 sm:p-8 mb-16 scroll-mt-24" aria-labelledby="finder-title" data-testid="offer-finder">
      <p className="section-label mb-2">{t.label}</p>
      <h2 id="finder-title" className="font-display font-bold mb-2" style={{ fontSize: 'clamp(1.4rem,3vw,1.9rem)', color: 'var(--text)' }}>{t.title}</h2>
      {!done && <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', maxWidth: 560 }}>{t.intro}</p>}

      {!done && (
        <div data-testid="finder-question">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }} aria-live="polite">{t.questionOf(step + 1, STEPS.length)}</span>
            <span className="flex gap-1.5" aria-hidden="true">
              {STEPS.map((s, i) => <span key={s} style={{ width: 28, height: 3, background: i <= step ? 'var(--brand, var(--accent))' : 'var(--border)' }} />)}
            </span>
          </div>
          <fieldset>
            <legend className="font-display font-semibold text-lg mb-4" style={{ color: 'var(--text)' }}>{question.title}</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              {OPTIONS[current].map((value) => {
                const selected = answers[current] === value
                return (
                  <label
                    key={value}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer text-sm transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-within:outline-2 focus-within:outline-offset-2"
                    style={{ border: `1px solid ${selected ? 'var(--brand, var(--accent))' : 'var(--border)'}`, background: selected ? 'var(--brand-soft, var(--accent-glow))' : 'var(--surface)', color: 'var(--text)', outlineColor: 'var(--brand, var(--accent))' }}
                  >
                    <input
                      type="radio"
                      name={`finder-${current}`}
                      value={value}
                      checked={selected}
                      // A click chooses, even on the option already ticked (after "Back"): onChange would not fire
                      // for it. Enter chooses too; the arrows only move the focus, so a keyboard user can read
                      // every option before choosing.
                      onClick={() => choose(current, value)}
                      onChange={() => undefined}
                      onKeyDown={(e) => onOptionKey(e, current, value)}
                      className="sr-only"
                      data-testid={`finder-${current}-${value}`}
                    />
                    <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${selected ? 'var(--brand, var(--accent))' : 'var(--border)'}`, background: selected ? 'var(--brand, var(--accent))' : 'transparent', flexShrink: 0 }} />
                    {(question.options as Record<string, string>)[value]}
                  </label>
                )
              })}
            </div>
          </fieldset>
          {step > 0 && (
            <button type="button" onClick={back} className="btn-secondary btn-sm mt-5" data-testid="finder-back">
              <Icon name="arrowLeft" size={14} />
              {t.back}
            </button>
          )}
        </div>
      )}

      {advice && (
        <div aria-live="polite" data-testid="finder-result">
          {advice.best ? (
            <>
              <div className="p-5 sm:p-6" style={{ border: '1px solid var(--brand, var(--accent))', background: 'var(--brand-soft, var(--accent-glow))' }}>
                <p className="section-label mb-2">{t.result.best}</p>
                <h3 ref={headingRef} tabIndex={-1} className="font-display font-bold text-xl mb-2 outline-none" style={{ color: 'var(--text)' }} data-testid="finder-best">{title(advice.best.offer)}</h3>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>{description(advice.best.offer)}</p>
                <p className="font-display font-bold text-lg" style={{ color: 'var(--accent)' }}>{advice.best.offer.priceLabel}</p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>{t.result.priceNote}</p>
                {features(advice.best.offer).length > 0 && (
                  <ul className="space-y-1.5 mb-4">
                    {features(advice.best.offer).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                        <Icon name="check" size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />{f}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>{t.result.why}</p>
                <ul className="space-y-1.5 mb-5" data-testid="finder-reasons">
                  {reasons(advice.best).map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <Icon name="chevronRight" size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--brand, var(--accent))' }} />{r}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => onRequestQuote(title(advice.best!.offer))} className="btn-primary text-sm" data-testid="finder-quote">{t.result.quote}</button>
                  <Link href={`/${locale}/devis`} className="btn-secondary text-sm">{t.result.onlineQuote}</Link>
                  <WhatsAppButton href={whatsappFor(title(advice.best.offer), summary)} label={t.result.whatsapp} />
                </div>
              </div>

              {advice.alternatives.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{t.result.alternatives}</p>
                  <ul className="grid sm:grid-cols-2 gap-3">
                    {advice.alternatives.map(({ offer }) => (
                      <li key={offer.id} className="p-4" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }} data-testid="finder-alternative">
                        <p className="font-display font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>{title(offer)}</p>
                        <p className="text-xs mb-2" style={{ color: 'var(--accent)' }}>{offer.priceLabel}</p>
                        <button type="button" onClick={() => onRequestQuote(title(offer))} className="text-xs font-medium underline underline-offset-2" style={{ color: 'var(--text-muted)' }}>{t.result.quote}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="p-5" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <h3 ref={headingRef} tabIndex={-1} className="font-display font-semibold text-lg mb-2 outline-none" style={{ color: 'var(--text)' }}>{t.result.best}</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }} data-testid="finder-none">{t.result.none}</p>
              <div className="flex flex-wrap gap-3">
                <Link href={`/${locale}/contact`} className="btn-primary text-sm">{t.result.contact}</Link>
                <WhatsAppButton href={whatsappFor('', summary)} label={t.result.whatsapp} />
              </div>
            </div>
          )}
          <button type="button" onClick={restart} className="btn-secondary btn-sm mt-6" data-testid="finder-restart">{t.restart}</button>
        </div>
      )}
    </section>
  )
}
