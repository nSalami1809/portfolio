import FadeIn from '@/components/animations/FadeIn'
import ContactForm from '@/components/sections/ContactForm'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { pageMeta } from '@/lib/seo'
import Icon from '@/components/ui/Icon'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  return pageMeta({ locale, path: '/contact', title: 'Contact', description: t.contact.subtitle })
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  return (
    <div className="relative">
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
                    <Icon name="mail" size={18} />
                  ),
                  label: t.contact.email,
                  value: 'nemrodsalami1809@gmail.com',
                  href: 'mailto:nemrodsalami1809@gmail.com',
                },
                {
                  icon: (
                    <Icon name="location" size={18} />
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
                  style={{ background: 'rgba(0,128,0,0.12)', color: '#008000' }}
                >
                  <Icon name="check" size={18} />
                  <span
                    className="absolute -top-0.5 -right-0.5 inline-block w-2.5 h-2.5"
                    style={{ background: '#008000', border: '2px solid var(--surface)' }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                    {t.contact.availability}
                  </p>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#008000', fontFamily: 'var(--font-poppins)' }}>
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
