import type { Metadata, Viewport } from 'next'
import { Inter, Poppins, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { PortfolioStaticProvider, defaultPortfolioData } from '@/providers/PortfolioContext'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import AdminGate from '@/components/AdminGate'
import ChatWidgetLoader from '@/components/chat/ChatWidgetLoader'
import VisitTracker from '@/components/analytics/VisitTracker'
import MotionProvider from '@/components/MotionProvider'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

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
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  // A single dark value painted near-black browser chrome above a white page
  // for every light-mode visitor; match the theme instead.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0B0F' },
  ],
  // Lets the page paint under the notch/home indicator, which is what makes
  // env(safe-area-inset-*) resolve to non-zero values on fixed elements.
  viewportFit: 'cover',
}

// Runs before first paint so the correct theme class is already on <html>
// when React hydrates — without this, the page would flash the wrong
// theme for a frame on every load. suppressHydrationWarning on <html> is
// required because this script intentionally changes className before
// React's hydration check runs.
// Defaults to the visitor's OS/browser color-scheme preference (light or
// dark) when they haven't explicitly picked a theme via the toggle yet —
// an explicit choice stored in localStorage always wins.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var dark=t?t!=='light':window.matchMedia('(prefers-color-scheme: dark)').matches;if(dark)document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolved server-side (cached + tagged 'portfolio', deduped per request) so
  // the public tree reads real data straight out of the SSR HTML instead of
  // re-fetching it over a Server Action after hydration. See
  // PortfolioStaticProvider for the full rationale.
  const portfolio = await fetchPortfolioSafe('root layout')

  return (
    <html
      lang="fr"
      className={`${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>
          <PortfolioStaticProvider data={portfolio ?? defaultPortfolioData}>
            {children}
            <AdminGate />
            <ChatWidgetLoader />
            <VisitTracker />
          </PortfolioStaticProvider>
        </MotionProvider>
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  )
}
