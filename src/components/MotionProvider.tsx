'use client'

import { LazyMotion, domMax } from 'framer-motion'

// Bundled statically (not the async `features={() => import(...)}` form):
// nearly every page fires an entrance animation immediately on first paint
// (FadeIn, PageTransition, HeroSection's stagger), so deferring the
// animation engine to a chunk fetched *after* hydration only adds a
// sequential network round-trip — measured as a real regression (Lighthouse
// mobile performance 100 -> 68, LCP 0.8s -> 6s) rather than the intended
// win. Bundling it statically still gets LazyMotion's main benefit — less
// code than importing the full `motion` component everywhere — while
// letting this chunk load in parallel with the rest of the app like any
// other dependency.
//
// `domMax` (not the smaller `domAnimation`) is required because a few
// components — the public Projects grid included — use shared `layout`
// animations, which domAnimation doesn't cover.
//
// `strict` throws if any `motion.*` component slips through instead of
// `m.*`, which would otherwise silently re-pull the full bundle for that
// component and quietly defeat the point of this provider. PageTransition.tsx
// no longer uses framer-motion at all (see the comment there — its
// AnimatePresence-based fade was the actual cause of a production bug,
// unrelated to `m` vs `motion`), so there's nothing exempting it from
// `strict` anymore.
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      {children}
    </LazyMotion>
  )
}
