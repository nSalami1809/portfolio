import type { Metadata } from 'next'
import { Inter, Poppins, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { PortfolioProvider } from '@/providers/PortfolioContext'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PageTransition from '@/components/animations/PageTransition'
import AdminGate from '@/components/AdminGate'

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`dark ${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`}
      data-scroll-behavior="smooth"
    >
      <head>
        <link rel="preconnect" href="https://prod.spline.design" />
        <link rel="dns-prefetch" href="https://prod.spline.design" />
        <link rel="preconnect" href="https://unpkg.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://unpkg.com" />
      </head>
      <body>
        <PortfolioProvider>
          <Navbar />
          <PageTransition>
            <main className="pt-20">{children}</main>
          </PageTransition>
          <Footer />
          <AdminGate />
        </PortfolioProvider>
      </body>
    </html>
  )
}
