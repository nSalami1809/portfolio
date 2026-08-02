'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { translateText } from '@/actions/translate'

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <li>
      <Link
        href={href}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200"
        style={{
          color: hovered ? 'var(--accent)' : 'var(--text-muted)',
          background: hovered ? 'var(--accent-glow)' : 'transparent',
          transform: hovered ? 'translateX(3px)' : 'translateX(0)',
          fontFamily: 'var(--font-poppins)',
        }}
      >
        <span
          className="flex-shrink-0 transition-colors duration-200"
          style={{ color: hovered ? 'var(--accent)' : 'var(--text-subtle)' }}
        >
          {icon}
        </span>
        {label}
      </Link>
    </li>
  )
}

function SocialItem({
  href,
  label,
  icon,
  external = false,
}: {
  href: string
  label: string
  icon: React.ReactNode
  external?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 group"
      style={{
        color: hovered ? 'var(--text)' : 'var(--text-muted)',
        background: hovered ? 'var(--surface)' : 'transparent',
        border: hovered ? '1px solid var(--border)' : '1px solid transparent',
        transform: hovered ? 'translateX(3px)' : 'translateX(0)',
        fontFamily: 'var(--font-poppins)',
      }}
    >
      <span
        className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-all duration-200"
        style={{
          background: hovered ? 'var(--accent-glow)' : 'var(--surface)',
          color: hovered ? 'var(--accent)' : 'var(--text-subtle)',
          border: hovered ? '1px solid var(--glass-border)' : '1px solid var(--border)',
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </a>
  )
}

export default function Footer() {
  const { data } = usePortfolio()
  const locale = useLocale()
  const t = useDictionary()
  const year = new Date().getFullYear()

  const [translatedRole, setTranslatedRole] = useState<string | null>(null)

  useEffect(() => {
    if (locale !== 'en' || !data.personal.role) { setTranslatedRole(null); return } // eslint-disable-line react-hooks/set-state-in-effect
    translateText('personal:role', 'en', { role: data.personal.role })
      .then((fields) => setTranslatedRole(fields.role ?? null))
      .catch(() => {})
  }, [locale, data.personal.role])

  const navLinks = [
    {
      href: `/${locale}`,
      label: t.nav.about,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/resume`,
      label: t.nav.resume,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/projects`,
      label: t.nav.projects,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="2" x2="12" y2="22"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/offres`,
      label: t.nav.offers,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2.83 12.83A2 2 0 0 1 2 11.17V4a2 2 0 0 1 2-2h7.17a2 2 0 0 1 1.42.59l7.98 7.99a2 2 0 0 1 .02 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/blog`,
      label: t.nav.blog,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      ),
    },
    {
      href: `/${locale}/contact`,
      label: t.nav.contact,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
      ),
    },
  ]

  return (
    <footer aria-label={t.footer.aria} style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">

          {/* Brand */}
          <div>
            <div className="font-display font-bold text-2xl mb-3" style={{ color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)' }}>N</span>·S
            </div>
            <p className="text-sm leading-relaxed max-w-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {translatedRole ?? data.personal.role}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10B981' }} />
              <span className="text-xs" style={{ color: '#10B981', fontFamily: 'var(--font-poppins)' }}>
                {t.footer.available}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p className="section-label mb-3">{t.footer.navigation}</p>
            <ul className="space-y-0.5">
              {navLinks.map((link) => (
                <NavItem key={link.href} {...link} />
              ))}
            </ul>
          </div>

          {/* Contact & socials */}
          <div>
            <p className="section-label mb-3">{t.footer.contactSocials}</p>
            <div className="space-y-1.5">
              {data.personal.email && (
                <SocialItem
                  href={`mailto:${data.personal.email}`}
                  label={data.personal.email}
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  }
                />
              )}
              {data.personal.whatsapp && (
                <SocialItem
                  href={`https://wa.me/${data.personal.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(t.footer.whatsappMessage)}`}
                  label="WhatsApp"
                  external
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm5.8 14.13c-.24.68-1.4 1.31-1.93 1.36-.51.05-1.02.24-3.43-.72-2.9-1.16-4.76-4.13-4.9-4.32-.14-.19-1.17-1.56-1.17-2.98s.73-2.11 1-2.4c.24-.27.53-.34.71-.34.18 0 .36 0 .51.01.17.01.39-.06.6.47.24.6.81 2.06.88 2.21.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.25 1.62 2.02 1.11.99 2.05 1.3 2.34 1.44.29.15.46.13.63-.08.17-.21.71-.83.9-1.11.19-.29.37-.24.63-.15.26.1 1.64.78 1.92.92.29.14.48.21.55.33.07.12.07.7-.17 1.38z"/>
                    </svg>
                  }
                />
              )}
              {data.socials.github && (
                <SocialItem
                  href={data.socials.github}
                  label="GitHub"
                  external
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                    </svg>
                  }
                />
              )}
              {data.socials.linkedin && (
                <SocialItem
                  href={data.socials.linkedin}
                  label="LinkedIn"
                  external
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  }
                />
              )}
              {data.socials.instagram && (
                <SocialItem
                  href={data.socials.instagram}
                  label="Instagram"
                  external
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                    </svg>
                  }
                />
              )}
            </div>
          </div>
        </div>

        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-center"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-subtle)' }}
        >
          <p>&copy; {year} {data.personal.name}. {t.footer.rights}</p>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <Link href={`/${locale}/mentions-legales`} className="hover:underline">{t.footer.legalNotice}</Link>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <Link href={`/${locale}/confidentialite`} className="hover:underline">{t.footer.privacyPolicy}</Link>
        </div>
      </div>
    </footer>
  )
}
