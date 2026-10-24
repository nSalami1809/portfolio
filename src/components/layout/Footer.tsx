'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { PersonalInfo, SocialLinks } from '@/types'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import Icon, { type IconName } from '@/components/ui/Icon'
import { whatsappLink } from '@/lib/whatsapp'

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

interface FooterProps {
  personal: PersonalInfo
  socials: SocialLinks
  locale: Locale
  t: { nav: Dictionary['nav']; footer: Dictionary['footer'] }
  // Already translated server-side. The footer sits in the locale layout, so
  // it renders on EVERY public page — translating the role from a client
  // effect meant one Server Action POST per page view for every English
  // visitor, plus a visible text swap once it landed.
  role: string
}

export default function Footer({ personal, socials, locale, t, role }: FooterProps) {
  const year = new Date().getFullYear()

  const icon = (name: IconName) => <Icon name={name} size={13} />

  // The portfolio itself: who, what, where to read.
  const portfolioLinks = [
    { href: `/${locale}`, label: t.nav.about, icon: icon('about') },
    { href: `/${locale}/resume`, label: t.nav.resume, icon: icon('experience') },
    { href: `/${locale}/vision`, label: t.nav.vision, icon: icon('vision') },
    { href: `/${locale}/projects`, label: t.nav.projects, icon: icon('projects') },
    { href: `/${locale}/blog`, label: t.nav.blog, icon: icon('blog') },
    { href: `/${locale}/documents`, label: t.nav.documents, icon: icon('documents') },
    { href: `/${locale}/playground`, label: t.nav.playground, icon: icon('lab') },
  ]

  // Everything "Travailler avec moi" holds, in the order of a project: look, understand, price, talk, follow.
  // The same pages as the menu's drop-down, so the footer is a second way in, not another list.
  const workLinks = [
    { href: `/${locale}/offres`, label: t.nav.workOffers, icon: icon('store') },
    { href: `/${locale}/methode`, label: t.nav.workMethod, icon: icon('target') },
    { href: `/${locale}/guides`, label: t.nav.workGuides, icon: icon('blog') },
    { href: `/${locale}/devis`, label: t.nav.workQuote, icon: icon('invoice') },
    { href: `/${locale}/calendrier`, label: t.nav.workCall, icon: icon('calendar') },
    { href: `/${locale}/suivi`, label: t.nav.workTrack, icon: icon('delivery') },
    { href: `/${locale}/contact`, label: t.nav.contact, icon: icon('mail') },
  ]

  return (
    <footer aria-label={t.footer.aria} style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div>
            <div className="font-display font-bold text-2xl mb-3" style={{ color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)' }}>N</span>·S
            </div>
            <p className="text-sm leading-relaxed max-w-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {role}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 flex-shrink-0" style={{ background: '#008000' }} />
              <span className="text-xs" style={{ color: '#008000', fontFamily: 'var(--font-poppins)' }}>
                {t.footer.available}
              </span>
            </div>
          </div>

          {/* The portfolio */}
          <nav aria-label={t.footer.portfolio} data-testid="footer-portfolio">
            <p className="section-label mb-3">{t.footer.portfolio}</p>
            <ul className="space-y-0.5">
              {portfolioLinks.map((link) => (
                <NavItem key={link.href} {...link} />
              ))}
            </ul>
          </nav>

          {/* Working with me: its own column, with everything the menu entry holds */}
          <nav aria-label={t.nav.offers} data-testid="footer-work">
            <p className="section-label mb-1">
              <Link href={`/${locale}/offres`} className="hover:underline">{t.nav.offers}</Link>
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>{t.footer.workHint}</p>
            <ul className="space-y-0.5">
              {workLinks.map((link) => (
                <NavItem key={link.href} {...link} />
              ))}
            </ul>
          </nav>

          {/* Contact & socials */}
          <div>
            <p className="section-label mb-3">{t.footer.contactSocials}</p>
            <div className="space-y-1.5">
              {personal.email && (
                <SocialItem
                  href={`mailto:${personal.email}`}
                  label={personal.email}
                  icon={
                    <Icon name="mail" size={13} />
                  }
                />
              )}
              {personal.whatsapp && (
                <SocialItem
                  href={whatsappLink(personal.whatsapp, { kind: 'general' }, locale, personal.name)}
                  label="WhatsApp"
                  external
                  icon={
                    <Icon name="whatsapp" size={13} />
                  }
                />
              )}
              {socials.github && (
                <SocialItem
                  href={socials.github}
                  label="GitHub"
                  external
                  icon={
                    <Icon name="github" size={13} />
                  }
                />
              )}
              {socials.linkedin && (
                <SocialItem
                  href={socials.linkedin}
                  label="LinkedIn"
                  external
                  icon={
                    <Icon name="linkedin" size={13} />
                  }
                />
              )}
              {socials.instagram && (
                <SocialItem
                  href={socials.instagram}
                  label="Instagram"
                  external
                  icon={
                    <Icon name="instagram" size={13} />
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
          <p>&copy; {year} {personal.name}. {t.footer.rights}</p>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <Link href={`/${locale}/mentions-legales`} className="hover:underline">{t.footer.legalNotice}</Link>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <Link href={`/${locale}/confidentialite`} className="hover:underline">{t.footer.privacyPolicy}</Link>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <Link href={`/${locale}/cgv`} className="hover:underline">{t.footer.terms}</Link>
        </div>
      </div>
    </footer>
  )
}
