import type { Metadata } from 'next'
import FadeIn from '@/components/animations/FadeIn'
import ContactForm from '@/components/sections/ContactForm'
import SignalPulseClient from '@/components/scene/SignalPulseClient'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <div className="relative">
      <SignalPulseClient />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <FadeIn>
          <p className="section-label mb-3">Discutons</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
            Contact
          </h1>
          <p className="text-lg mb-16" style={{ color: 'var(--text-muted)', maxWidth: 500 }}>
            Une idée, un projet, une question ? Je réponds à tous les messages.
          </p>
        </FadeIn>

        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-12">
          {/* Infos */}
          <FadeIn direction="right">
            <div className="space-y-6">
              {[
                {
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  ),
                  label: 'Email',
                  value: 'nemrodsalami1809@gmail.com',
                  href: 'mailto:nemrodsalami1809@gmail.com',
                },
                {
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  ),
                  label: 'Localisation',
                  value: 'Libreville, Gabon — Disponible en remote',
                  href: undefined,
                },
              ].map(({ icon, label, value, href }) => (
                <div key={label} className="card p-5 flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
                  >
                    {icon}
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                      {label}
                    </p>
                    {href ? (
                      <a href={href} className="text-sm hover:text-[var(--accent)] transition-colors duration-200" style={{ color: 'var(--text)' }}>
                        {value}
                      </a>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text)' }}>{value}</p>
                    )}
                  </div>
                </div>
              ))}

              <div className="card p-6">
                <p className="section-label mb-4">Disponibilité</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
                  <span className="text-sm font-medium" style={{ color: '#10B981', fontFamily: 'var(--font-poppins)' }}>
                    Disponible pour de nouvelles missions
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Réponse sous 48h ouvrables.
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Formulaire */}
          <FadeIn delay={0.15}>
            <ContactForm />
          </FadeIn>
        </div>
      </div>
    </div>
  )
}
