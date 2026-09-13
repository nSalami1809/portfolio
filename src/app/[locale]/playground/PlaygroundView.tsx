'use client'

import FadeIn from '@/components/animations/FadeIn'
import CodePlaygroundLoader from '@/components/playground/CodePlaygroundLoader'
import type { Dictionary } from '@/lib/i18n/dictionaries'

interface Props {
  t: Dictionary['playground']
}

export default function PlaygroundView({ t }: Props) {
  return (
    <div className="relative">
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <FadeIn>
          <p className="section-label mb-3">{t.label}</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
            {t.title}
          </h1>
          <p className="text-lg mb-12" style={{ color: 'var(--text-muted)', maxWidth: 520 }}>
            {t.subtitle}
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <CodePlaygroundLoader t={t} />
        </FadeIn>
      </div>
    </div>
  )
}
