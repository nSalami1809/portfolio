import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { translateFields } from '@/lib/translate'
import { defaultPersonalInfo, defaultSocials } from '@/data/defaultData'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PageTransition from '@/components/animations/PageTransition'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

// Navbar/Footer/PageTransition live here (scoped to the /[locale] segment)
// rather than the root layout — /admin/* is a sibling route tree that never
// passes through this layout, so the public chrome (and its locale-switch
// link, which only makes sense for locale-prefixed paths) can never leak
// onto admin pages.
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = getDictionary(locale)

  // The chrome's own data, resolved here instead of in the client components.
  // `fetchPortfolioSafe` is cached + request-deduped, so this costs nothing on
  // top of what the page itself already fetches, and the role translation is
  // the same MongoDB-cached lookup every other translated string uses —
  // rather than a per-page-view Server Action round trip from the footer.
  const portfolio = await fetchPortfolioSafe('[locale]/layout')
  const personal = portfolio?.personal ?? defaultPersonalInfo
  const socials = portfolio?.socials ?? defaultSocials
  const { role } = await translateFields('personal:role', locale, { role: personal.role })

  return (
    <>
      {/* Visible only once focused, so keyboard and screen-reader users can
          jump past the nine-item nav on every page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
      >
        {locale === 'en' ? 'Skip to content' : 'Aller au contenu'}
      </a>
      <Navbar locale={locale} t={t.nav} />
      <PageTransition>
        <main id="main-content" className="pt-20">{children}</main>
      </PageTransition>
      <Footer
        personal={personal}
        socials={socials}
        locale={locale}
        t={{ nav: t.nav, footer: t.footer }}
        role={role}
      />
    </>
  )
}
