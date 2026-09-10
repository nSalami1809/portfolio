'use client'

// Deliberately NOT AnimatePresence + motion/m anymore. The previous version
// wrapped <main> in <AnimatePresence mode="wait"><m.div key={pathname}
// initial="initial" animate="animate" .../></AnimatePresence> for a fade
// between pages. Isolated and confirmed live (production screenshots, then
// a scripted browser reproduction, then direct computed-style inspection)
// that this is the actual cause of the "blank /projects, then it spreads to
// other pages" bug: after a client-side (Link click) navigation, the new
// page's wrapper regularly gets stuck at its `initial` opacity:0 state and
// never transitions to `animate` — the new page's content is fully present
// in the DOM (confirmed via innerText) but invisible, and because this
// wrapper never remounts across navigations, the very next click can hit
// the same stuck state on the following page too. A fresh/direct page load
// was never affected — only client-side transitions were, which is why the
// bug looked intermittent. Swapping `m.div` for plain `motion.div` (ruling
// out the LazyMotion(strict) provider as the cause) did NOT fix it either —
// confirmed by rebuilding and re-testing. The failure is in the
// AnimatePresence(mode="wait") + opacity-variant pattern itself under this
// app's Next.js App Router navigation, not in which Framer Motion import
// style is used. Given it has now broken production twice, do not
// reintroduce a route-level AnimatePresence fade here without first
// verifying, with a real multi-page click-through (not just a fresh load),
// that pages never end up stuck invisible.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
