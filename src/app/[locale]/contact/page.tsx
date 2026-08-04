import FadeIn from '@/components/animations/FadeIn'
import ContactForm from '@/components/sections/ContactForm'
import StarsCanvasClient from '@/components/scene/StarsCanvasClient'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'

export async function generateMetadata() {
  return { title: 'Contact' }
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  return (
    <div className="relative">
      <StarsCanvasClient className="z-0 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <FadeIn>
          <p className="section-label mb-3">{t.contact.label}</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
            {t.contact.title}
          </h1>
          <p className="text-lg mb-16" style={{ color: 'var(--text-muted)', maxWidth: 500 }}>
            {t.contact.subtitle}
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
                  label: t.contact.email,
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
                  label: t.contact.location,
                  value: t.contact.locationValue,
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

              <div className="card p-5 flex items-start gap-4">
                <div
                  className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10B981' }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#10B981', border: '2px solid var(--surface)' }} />
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                    {t.contact.availability}
                  </p>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#10B981', fontFamily: 'var(--font-poppins)' }}>
                    {t.contact.availableMissions}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t.contact.responseTime}
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Formulaire */}
          <FadeIn delay={0.15}>
            <ContactForm t={t.contact.form} />
          </FadeIn>
        </div>
      </div>
    </div>
  )
}
