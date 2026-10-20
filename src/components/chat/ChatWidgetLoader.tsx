'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { onOpenChatRequest } from '@/lib/chat-bridge'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChatBotIcon } from '@hugeicons/core-free-icons'
import { TEASER_TEXT, teaserAllowed } from '@/lib/chat-services'

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
const TOGGLE_LABEL = { fr: 'Ouvrir NemCopilotIA', en: 'Open NemCopilotIA' } as const

// The invitation bubble: shown once per browser session, a few seconds after arriving
// on a page where it does not get in the way, and gone as soon as the chat is opened
// or the visitor closes it. Dependency-free, like the stub, so it costs no extra chunk.
const TEASER_KEY = 'nemcopilot-invite-seen'
const TEASER_DELAY_MS = 9000
const TEASER_VISIBLE_MS = 16000

function InviteBubble({ locale, pathname }: { locale: 'fr' | 'en'; pathname: string | null }) {
  const [visible, setVisible] = useState(false)
  const allowed = teaserAllowed(pathname)

  useEffect(() => {
    if (!allowed) return
    let seen = false
    try { seen = sessionStorage.getItem(TEASER_KEY) === '1' } catch { /* private mode: show it once per page load */ }
    if (seen) return
    const show = setTimeout(() => {
      try { sessionStorage.setItem(TEASER_KEY, '1') } catch { /* ignore */ }
      setVisible(true)
    }, TEASER_DELAY_MS)
    const hide = setTimeout(() => setVisible(false), TEASER_DELAY_MS + TEASER_VISIBLE_MS)
    // Opening the chat (by its button or the panel itself) makes the invitation pointless.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-chat-toggle], #chat-widget-panel')) {
        clearTimeout(show)
        setVisible(false)
      }
    }
    document.addEventListener('click', onClick, true)
    const stopBridge = onOpenChatRequest(() => { clearTimeout(show); setVisible(false) })
    return () => {
      clearTimeout(show)
      clearTimeout(hide)
      document.removeEventListener('click', onClick, true)
      stopBridge()
    }
  }, [allowed])

  if (!allowed || !visible) return null
  const t = TEASER_TEXT[locale]
  return (
    <div
      role="status"
      data-testid="chat-invite"
      className="fixed z-40 flex items-start gap-2 p-3"
      style={{
        right: '1.25rem',
        bottom: 'calc(5.25rem + env(safe-area-inset-bottom))',
        maxWidth: 'min(260px, calc(100vw - 2.5rem))',
        background: 'var(--bg)',
        color: 'var(--text)',
        border: '1px solid var(--brand, var(--accent))',
        boxShadow: '4px 4px 0 var(--brand, var(--accent))',
      }}
    >
      <button
        type="button"
        className="text-left text-xs leading-snug"
        style={{ fontFamily: 'var(--font-poppins)' }}
        onClick={() => document.querySelector<HTMLElement>('[data-chat-toggle]')?.click()}
      >
        {t.text}
      </button>
      <button type="button" aria-label={t.close} onClick={() => setVisible(false)} className="flex-shrink-0 text-sm leading-none px-1" style={{ color: 'var(--text-subtle)' }}>×</button>
    </div>
  )
}

const IDLE_TIMEOUT_MS = 4000

// Static twin of ChatWidget's animated BotIcon in its 'idle' mood: the same Hugeicons
// ChatBot drawing, drawn directly. BotIcon itself is not imported: it would drag the
// animation library back into this chunk, which is the one thing this loader exists to
// avoid (the icon data and its renderer are tiny and already on every public page).
function StaticBotIcon({ size = 26 }: { size?: number }) {
  return (
    <HugeiconsIcon icon={ChatBotIcon} size={size} color="currentColor" strokeWidth={1.5} aria-hidden="true" />
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
      data-chat-toggle
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
      <>
        <InviteBubble locale={locale} pathname={pathname} />
        <ChatBubbleStub
          label={TOGGLE_LABEL[locale]}
          onClick={() => {
            setAutoOpen(true)
            load()
          }}
        />
      </>
    )
  }

  return (
    <>
      <InviteBubble locale={locale} pathname={pathname} />
      <ChatWidget autoOpen={autoOpen} initialMessage={pendingMessage} />
    </>
  )
}
