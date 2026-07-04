import type { Metadata } from 'next'
import { Inter, Poppins, Space_Grotesk } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { PortfolioProvider } from '@/providers/PortfolioContext'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PageTransition from '@/components/animations/PageTransition'
import AdminGate from '@/components/AdminGate'
import { fetchPortfolio } from '@/actions/portfolio'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nawaf.dev'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Nawaf Nemrod Salami — Développeur Fullstack & DevOps',
    template: '%s | Nawaf Nemrod Salami',
  },
  description: 'Développeur web fullstack et DevOps basé à Libreville, Gabon. Je conçois et déploie des applications modernes, robustes et élégantes.',
  keywords: ['développeur web', 'fullstack', 'DevOps', 'Next.js', 'React', 'Node.js', 'Docker', 'Kubernetes', 'Gabon', 'Libreville'],
  authors: [{ name: 'Nawaf Nemrod Salami' }],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE_URL,
    siteName: 'Nawaf Nemrod Salami',
    title: 'Nawaf Nemrod Salami — Développeur Fullstack & DevOps',
    description: 'Développeur web fullstack et DevOps. Je conçois et déploie des applications modernes, robustes et élégantes.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Nawaf Nemrod Salami — Développeur Fullstack & DevOps' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nawaf Nemrod Salami — Développeur Fullstack & DevOps',
    description: 'Développeur web fullstack et DevOps. Je conçois et déploie des applications modernes, robustes et élégantes.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read admin-configured default theme (cached 60s) — used as fallback for new visitors
  const portfolio = await fetchPortfolio().catch(() => null)
  const defaultTheme = portfolio?.settings?.defaultTheme === 'light' ? 'light' : 'dark'

  return (
    <html
      lang="fr"
      className={`dark ${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/*
          Runs synchronously before first paint → no FOUC.
          Priority: 1) user's explicit localStorage choice  2) admin defaultTheme  3) dark
        */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem('portfolio-theme');var d='${defaultTheme}';var t=s==='light'?'light':s==='dark'?'dark':d;document.documentElement.classList.remove('dark','light');document.documentElement.classList.add(t);}catch(e){}`,
          }}
        />
        <ThemeProvider defaultTheme={defaultTheme}>
          <PortfolioProvider>
            <Navbar />
            <PageTransition>
              <main className="pt-20">{children}</main>
            </PageTransition>
            <Footer />
            <AdminGate />
          </PortfolioProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
