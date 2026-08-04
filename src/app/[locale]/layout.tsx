import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locale'
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

  return (
    <>
      <Navbar />
      <PageTransition>
        <main className="pt-20">{children}</main>
      </PageTransition>
      <Footer />
    </>
  )
}
