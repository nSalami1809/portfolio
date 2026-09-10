// Shown by Next.js while a route segment under [locale] is still resolving
// its async work (MongoDB fetch, translation) during a client-side
// navigation. Without this file, PageTransition's AnimatePresence hides the
// outgoing page before the incoming one is ready, and there was nothing to
// render in between — a silent blank page, worse on a cold serverless
// start (first request after a deploy) or a cache miss, since those can
// take a couple of seconds.
export default function Loading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center" aria-live="polite" aria-busy="true">
      <div className="loader" />
    </div>
  )
}
