import Link from 'next/link'
import FadeIn from '@/components/animations/FadeIn'
import Disclosure from '@/components/ui/Disclosure'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/locale'
import type { WorkTerms } from '@/lib/business'
import Icon, { iconForText, type IconName } from '@/components/ui/Icon'

// Used when a step's own words say nothing: the usual run of a project.
const STEP_ICONS: IconName[] = ['invoice', 'signature', 'code', 'delivery', 'support', 'shield']

// What each commitment is about, from its label (French or English); the list varies with the settings.
function commitmentIcon(label: string): IconName {
  const l = label.toLowerCase()
  if (/délai|delai|lead time/.test(l)) return 'clock'
  if (/acompte|deposit/.test(l)) return 'wallet'
  if (/révision|revision/.test(l)) return 'pen'
  if (/garantie|warranty/.test(l)) return 'shield'
  if (/code source|source code/.test(l)) return 'code'
  if (/signé|signed/.test(l)) return 'signature'
  return 'check'
}

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
                  <div className="flex items-center justify-between mb-4" aria-hidden="true">
                    <Icon name={iconForText(step.title, STEP_ICONS[i % STEP_ICONS.length])} size={30} style={{ color: 'var(--brand, var(--accent))' }} />
                    <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
                  </div>
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
                <Icon name={commitmentIcon(c.label)} size={28} className="mb-3" style={{ color: 'var(--brand, var(--accent))' }} />
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
          <h2 id="work-faq-title" className="section-title mb-4" style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{t.faqTitle}</h2>
          <p className="text-sm mb-8 flex items-center gap-2" style={{ color: 'var(--text-subtle)' }}>
            <span className="disclosure-badge">{faq.length}</span>
            {t.faqHint}
          </p>
        </FadeIn>
        <div className="max-w-3xl space-y-3">
          {faq.map((item, i) => (
            <FadeIn key={item.q} delay={Math.min(i * 0.05, 0.25)}>
              <Disclosure title={item.q} index={i + 1}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.a}</p>
              </Disclosure>
            </FadeIn>
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
                <Icon name="documents" size={26} className="mb-4" style={{ color: 'var(--accent)' }} />
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
