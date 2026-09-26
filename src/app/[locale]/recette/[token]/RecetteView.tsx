'use client'

import { useEffect, useState } from 'react'
import FadeIn from '@/components/animations/FadeIn'
import { usePortfolio } from '@/providers/portfolio-core'
import { getAcceptanceByToken } from '@/actions/lifecycle'
import type { Quote } from '@/actions/quotes'
import AcceptanceCard from './AcceptanceCard'

// The page behind the link of the "procès-verbal de recette" email: the
// delivery report and nothing else. (The devis / contract has its own page,
// /devis/signature/[token], with its own link.)
export default function RecetteView({ token }: { token: string }) {
  const { data } = usePortfolio()
  const { personal } = data
  const [quote, setQuote] = useState<Quote | null>(null)
  const [state, setState] = useState<'loading' | 'not-found' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false
    getAcceptanceByToken(token)
      .then((q) => {
        if (cancelled) return
        if (!q?.delivery) { setState('not-found'); return }
        setQuote(q)
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('not-found') })
    return () => { cancelled = true }
  }, [token])

  if (state === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  if (state === 'not-found' || !quote) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="card p-8 text-center" style={{ maxWidth: 420 }}>
          <p className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>Lien invalide</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ce lien est introuvable ou incorrect. Vérifiez qu&apos;il a été copié en entier.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh">
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <FadeIn>
          <div className="flex items-center gap-3 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset */}
            <img src="/logo-black.png" alt="" width={44} height={44} style={{ width: 44, height: 44 }} className="dark:invert" />
            <div>
              <p className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>{personal.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{personal.role}</p>
            </div>
          </div>
          <p className="section-label mb-1">{quote.kind === 'avenant' ? 'Avenant' : 'Devis'} n° {quote.numero}</p>
        </FadeIn>

        <AcceptanceCard token={token} quote={quote} onSigned={setQuote} />
      </div>
    </div>
  )
}
