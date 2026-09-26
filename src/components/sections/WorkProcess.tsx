import Link from 'next/link'
import FadeIn from '@/components/animations/FadeIn'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/locale'
import type { WorkTerms } from '@/lib/business'

interface Props {
  t: Dictionary['work']
  // From the same settings as the contract (lib/business.ts): the page can
  // never promise a delay, a deposit or a warranty the documents do not state.
  terms: WorkTerms
  locale: Locale
  className?: string
}

// The "Travailler avec moi" story told after the price list: how a project
// runs (steps), what is committed (numbers), the usual questions (FAQ), and
// where to start. Server-rendered, no client JS beyond the fade-in wrappers.
export default function WorkProcess({ t, terms, locale, className = 'space-y-28' }: Props) {
  const steps = t.steps(terms)
  const commitments = t.commitments(terms)
  const faq = t.faq(terms)

  return (
    <div className={className}>
      {/* ── Comment ça marche ── */}
      <section aria-labelledby="work-process-title">
        <FadeIn>
          <p className="section-label mb-3">{t.processLabel}</p>
          <h2 id="work-process-title" className="section-title mb-4" style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{t.processTitle}</h2>
          <p className="text-base mb-3" style={{ color: 'var(--text-muted)', maxWidth: 620 }}>{t.processSubtitle}</p>
          <p className="text-sm mb-10" style={{ color: 'var(--text-subtle)', maxWidth: 620 }}>{t.independentNote}</p>
        </FadeIn>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 m-0">
          {steps.map((step, i) => (
            <li key={step.title}>
              <FadeIn delay={Math.min(i * 0.06, 0.3)}>
                <div className="card p-6 h-full">
                  <span
                    className="inline-flex items-center justify-center font-display font-bold text-sm mb-4"
                    style={{ width: 32, height: 32, background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <h3 className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{step.text}</p>
                </div>
              </FadeIn>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Mes engagements ── */}
      <section aria-labelledby="work-commitments-title">
        <FadeIn>
          <p className="section-label mb-3">{t.commitmentsLabel}</p>
          <h2 id="work-commitments-title" className="section-title mb-4" style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{t.commitmentsTitle}</h2>
          <p className="text-sm mb-10" style={{ color: 'var(--text-subtle)', maxWidth: 620 }}>{t.commitmentsNote}</p>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {commitments.map((c, i) => (
            <FadeIn key={c.label} delay={Math.min(i * 0.06, 0.3)}>
              <div className="card p-6 h-full">
                <p className="font-display font-bold text-3xl mb-1" style={{ color: 'var(--accent)' }}>{c.value}</p>
                <p className="font-display font-semibold text-base mb-2" style={{ color: 'var(--text)' }}>{c.label}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.hint}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section aria-labelledby="work-faq-title">
        <FadeIn>
          <p className="section-label mb-3">{t.faqLabel}</p>
          <h2 id="work-faq-title" className="section-title mb-10" style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{t.faqTitle}</h2>
        </FadeIn>
        <div className="max-w-3xl space-y-3">
          {faq.map((item) => (
            <details key={item.q} className="card no-lift p-5 group">
              <summary className="cursor-pointer font-display font-semibold text-base" style={{ color: 'var(--text)' }}>{item.q}</summary>
              <p className="text-sm leading-relaxed mt-3" style={{ color: 'var(--text-muted)' }}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Documents types ── */}
      <section aria-labelledby="work-samples-title">
        <FadeIn>
          <p className="section-label mb-3">{t.samplesLabel}</p>
          <h2 id="work-samples-title" className="section-title mb-4" style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{t.samplesTitle}</h2>
          <p className="text-sm mb-10" style={{ color: 'var(--text-subtle)', maxWidth: 620 }}>{t.samplesText}</p>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.samples.map((sample, i) => (
            <FadeIn key={sample.key} delay={Math.min(i * 0.06, 0.3)}>
              <a
                href={`/api/exemples/${sample.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="card p-6 h-full flex flex-col"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mb-4" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8M16 17H8M10 9H8" />
                </svg>
                <h3 className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>{sample.title}</h3>
                <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: 'var(--text-muted)' }}>{sample.text}</p>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{t.samplesOpen} →</span>
              </a>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section>
        <FadeIn>
          <div className="p-6 sm:p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="section-title mb-4" style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{t.ctaTitle}</h2>
            <p className="mb-8 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>{t.ctaText}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={`/${locale}/devis`} className="btn-primary">{t.ctaQuote}</Link>
              <Link href={`/${locale}/calendrier`} className="btn-secondary">{t.ctaCall}</Link>
            </div>
            <p className="mt-6 text-sm flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link href={`/${locale}/suivi`} className="hover:underline" style={{ color: 'var(--text-subtle)' }}>{t.ctaTrack}</Link>
              <Link href={`/${locale}/cgv`} className="hover:underline" style={{ color: 'var(--text-subtle)' }}>{t.ctaTerms}</Link>
            </p>
          </div>
        </FadeIn>
      </section>
    </div>
  )
}
