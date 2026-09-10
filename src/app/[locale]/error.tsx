'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'

// Without this boundary, any uncaught error during a client-side route
// transition (a browser extension's content script colliding with the page,
// a transient network hiccup, anything) leaves the page silently blank —
// React unmounts the broken subtree and renders nothing, with no way to
// recover short of knowing to hit refresh. This turns that into a page with
// a retry button instead.
//
// Uses `unstable_retry`, not `reset` — `reset` only clears this boundary's
// local error state and re-renders the exact same (still-broken) children
// reference, so it does nothing for the common case here (a Server
// Component's data fetch failing). `unstable_retry` calls router.refresh()
// first, which actually re-fetches the RSC payload before resetting.
export default function LocaleError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const locale = useLocale()
  const t = useDictionary()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <p className="section-label mb-4">{t.error.title}</p>
        <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
          {t.error.description}
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button onClick={unstable_retry} className="btn-primary">
            {t.error.retry}
          </button>
          <Link href={`/${locale}`} className="btn-secondary">
            {t.error.backHome}
          </Link>
        </div>
      </div>
    </div>
  )
}
