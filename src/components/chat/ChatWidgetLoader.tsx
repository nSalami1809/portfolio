'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { onOpenChatRequest } from '@/lib/chat-bridge'

// The chat widget (react-markdown, remark-gfm, AI SDK client, the whole
// quote/booking UI) is a ~155KB gzipped chunk that only matters once a visitor
// actually opens it. `ssr: false` alone was not enough: it still fetched and
// executed the chunk immediately on hydration, on every page, for every
// visitor. Now nothing is requested until the visitor either clicks the bubble
// or the browser goes idle — whichever comes first.
const ChatWidget = dynamic(() => import('./ChatWidget'), {
  ssr: false,
  // Holds the bubble's exact appearance while the chunk is in flight, so
  // neither a click nor the idle preload ever makes the button flicker.
  loading: () => (
    <div
      aria-hidden="true"
      className="fixed bottom-5 right-5 z-40 flex items-center justify-center"
      style={{
        width: 56,
        height: 56,
        background: 'var(--accent)',
        boxShadow: '0 8px 30px var(--accent-glow)',
        color: 'var(--accent-contrast)',
      }}
    >
      <StaticBotIcon size={26} />
    </div>
  ),
})

// Two strings is not worth pulling the full ~30KB bilingual dictionary into
// the shared layout bundle just to label a button.
const TOGGLE_LABEL = { fr: "Ouvrir l'assistant", en: 'Open the assistant' } as const

const IDLE_TIMEOUT_MS = 4000

// Static, dependency-free twin of ChatWidget's animated BotIcon in its 'idle'
// mood. Deliberately duplicated rather than imported: importing it would drag
// the widget module (and its AI SDK / markdown deps) back into this chunk,
// which is the one thing this loader exists to avoid.
function StaticBotIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="2.6" r="1.15" fill="currentColor" />
      <line x1="12" y1="3.75" x2="12" y2="6.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="2.2" y="10.3" width="2.3" height="5" rx="1.15" fill="currentColor" />
      <rect x="19.5" y="10.3" width="2.3" height="5" rx="1.15" fill="currentColor" />
      <rect x="4.6" y="6.2" width="14.8" height="14" rx="5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9.7" cy="13.1" r="1.55" fill="currentColor" />
      <circle cx="14.3" cy="13.1" r="1.55" fill="currentColor" />
      <path d="M9.3 16.6c1 .95 4.4.95 5.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** Pixel-identical to ChatWidget's own closed-state toggle button. */
function ChatBubbleStub({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={false}
      className="fixed bottom-5 right-5 z-40 flex items-center justify-center"
      style={{
        width: 56,
        height: 56,
        background: 'var(--accent)',
        boxShadow: '0 8px 30px var(--accent-glow)',
        color: 'var(--accent-contrast)',
      }}
    >
      <StaticBotIcon size={26} />
    </button>
  )
}

export default function ChatWidgetLoader() {
  const pathname = usePathname()
  const params = useParams<{ locale?: string }>()
  const locale = params?.locale === 'en' ? 'en' : 'fr'

  const [loaded, setLoaded] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  // Read synchronously inside the bridge listener — `loaded` would be stale
  // there, and this decides whether the mounted widget already owns the event.
  const loadedRef = useRef(false)

  const load = useCallback(() => {
    loadedRef.current = true
    setLoaded(true)
  }, [])

  // Warm the chunk once the browser has nothing better to do, so a visitor who
  // *does* click later gets an instant panel instead of a network wait. The
  // generous timeout keeps it off the critical path on slow devices.
  useEffect(() => {
    if (loadedRef.current) return
    const idle = window.requestIdleCallback
    if (typeof idle === 'function') {
      const handle = idle(() => load(), { timeout: IDLE_TIMEOUT_MS })
      return () => window.cancelIdleCallback?.(handle)
    }
    const t = setTimeout(load, IDLE_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [load])

  // Other pages (e.g. the Offers page's "Request a quote" buttons) open the
  // chat with a pre-filled message. While the widget is still unloaded there
  // is no listener for that event, so the loader picks it up, mounts the
  // widget and hands the text over as a prop. Once mounted, the widget's own
  // listener owns these — hence the ref check, which stops a double send.
  useEffect(() => {
    return onOpenChatRequest((text) => {
      if (loadedRef.current) return
      setPendingMessage(text)
      setAutoOpen(true)
      load()
    })
  }, [load])

  // The widget hides itself on /admin; skip even the stub there.
  if (pathname?.startsWith('/admin')) return null

  if (!loaded) {
    return (
      <ChatBubbleStub
        label={TOGGLE_LABEL[locale]}
        onClick={() => {
          setAutoOpen(true)
          load()
        }}
      />
    )
  }

  return <ChatWidget autoOpen={autoOpen} initialMessage={pendingMessage} />
}
