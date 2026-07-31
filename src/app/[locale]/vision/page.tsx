'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import FadeIn from '@/components/animations/FadeIn'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { translateText } from '@/actions/translate'

const ParticleSphere = dynamic(() => import('@/components/vision/ParticleSphere'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
    </div>
  ),
})

export default function VisionPage() {
  const { data } = usePortfolio()
  const { vision } = data
  const locale = useLocale()
  const t = useDictionary()

  const [translated, setTranslated] = useState<Record<string, string>>({})

  useEffect(() => {
    if (locale !== 'en') { setTranslated({}); return } // eslint-disable-line react-hooks/set-state-in-effect
    const fields: Record<string, string> = { quote: vision.quote }
    vision.philosophie.forEach((p, i) => { fields[`philosophie_${i}`] = p })
    vision.approche.forEach((p, i) => { fields[`approche_${i}`] = p })
    vision.valeurs.forEach((v, i) => {
      fields[`valeur_title_${i}`] = v.title
      fields[`valeur_text_${i}`] = v.text
    })
    translateText('vision', 'en', fields).then(setTranslated).catch(() => {})
  }, [locale, vision])

  const tr = (key: string, fallback: string) => translated[key] ?? fallback

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">

      {/* ── Hero : titre + robot ─────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">

        {/* Left — texte */}
        <FadeIn>
          <p className="section-label mb-3">{t.vision.label}</p>
          <h1
            className="section-title mb-8"
            style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}
          >
            {t.vision.title}
          </h1>
          <blockquote
            className="pl-6"
            style={{ borderLeft: '3px solid var(--accent)' }}
          >
            <p
              className="font-display text-xl sm:text-2xl leading-relaxed italic"
              style={{ color: 'var(--text)' }}
            >
              &ldquo;{tr('quote', vision.quote)}&rdquo;
            </p>
          </blockquote>
        </FadeIn>

        {/* Right — particle sphere */}
        <FadeIn delay={0.15} direction="up">
          <div className="w-full h-64 sm:h-80 md:h-96 lg:h-[420px]">
            <ParticleSphere />
          </div>
        </FadeIn>
      </div>

      {/* ── Sections texte ───────────────────────────────────────────────── */}
      {[
        { label: t.vision.philosophyLabel, paragraphs: vision.philosophie, key: 'philosophie' },
        { label: t.vision.approachLabel,    paragraphs: vision.approche,    key: 'approche' },
      ].map(({ label, paragraphs, key }) => (
        <div key={key}>
          <div className="divider" />
          <div className="grid md:grid-cols-[180px_1fr] gap-10 mb-0">
            <FadeIn direction="right">
              <p className="section-label pt-1">{label}</p>
            </FadeIn>
            <FadeIn delay={0.1} direction="up">
              <div className="space-y-5">
                {paragraphs.map((p, j) => (
                  <p key={j} className="text-base leading-loose" style={{ color: 'var(--text-muted)' }}>
                    {tr(`${key}_${j}`, p)}
                  </p>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      ))}

      {/* ── Valeurs ──────────────────────────────────────────────────────── */}
      <div className="divider" />
      <FadeIn>
        <p className="section-label mb-10">{t.vision.valuesLabel}</p>
      </FadeIn>
      <div className="grid sm:grid-cols-3 gap-4">
        {vision.valeurs.map((v, i) => (
          <FadeIn key={v.title} delay={i * 0.1}>
            <div className="card p-6 h-full group">
              <h3
                className="font-display font-bold text-2xl mb-3 transition-colors duration-200 group-hover:text-[var(--accent)]"
                style={{ color: 'var(--text)' }}
              >
                {tr(`valeur_title_${i}`, v.title)}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {tr(`valeur_text_${i}`, v.text)}
              </p>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  )
}
