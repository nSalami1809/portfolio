import Script from 'next/script'

// Real-visitor performance (LCP, INP, CLS, FCP, TTFB, by device and page) for the Vercel dashboard's "Speed Insights" tab.
// This is the vendor's own snippet (what the @vercel/speed-insights package injects), loaded without the package: the package's
// optional framework peers conflict with this project's dependency tree. Same origin, so the CSP needs no change.
// Loaded only on Vercel (the script is served by the platform: locally it would be a 404) and only once the page is idle, so it
// never competes with the page's own start-up. Until Speed Insights is switched on for the project in the Vercel dashboard the
// script answers 404 and nothing happens.
export default function SpeedInsights() {
  if (!process.env.VERCEL) return null
  return (
    <>
      <Script id="speed-insights-queue" strategy="lazyOnload">
        {'window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments)}'}
      </Script>
      <Script src="/_vercel/speed-insights/script.js" strategy="lazyOnload" />
    </>
  )
}
