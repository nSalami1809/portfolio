'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { isChatWidgetMounted, onOpenChatRequest, openChatWithMessage } from '@/lib/chat-bridge'
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
const TEASER_VISIBLE_MS = 22000 // long enough to read the three questions and pick one

function InviteBubble({ locale, pathname, onShow }: { locale: 'fr' | 'en'; pathname: string | null; onShow: () => void }) {
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
      onShow() // the visitor is being invited to use it: get the chat ready so that a tap on a question answers at once
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
  }, [allowed, onShow])

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
        maxWidth: 'min(290px, calc(100vw - 2.5rem))',
        background: 'var(--bg)',
        color: 'var(--text)',
        border: '1px solid var(--brand, var(--accent))',
        boxShadow: '4px 4px 0 var(--brand, var(--accent))',
      }}
    >
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="text-left text-xs leading-snug"
          style={{ fontFamily: 'var(--font-poppins)' }}
          onClick={() => document.querySelector<HTMLElement>('[data-chat-toggle]')?.click()}
        >
          {t.text}
        </button>
        {/* Three questions to start with: one tap sends it to the assistant */}
        <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
          {t.questions.map((q) => (
            <li key={q}>
              <button
                type="button"
                className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-[var(--surface-hover)]"
                style={{ fontFamily: 'var(--font-poppins)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                onClick={() => { setVisible(false); openChatWithMessage(q) }}
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>
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
  // Read synchronously (state would be stale inside a listener): has the download of the chat been started?
  const loadedRef = useRef(false)

  const load = useCallback(() => {
    loadedRef.current = true
    setLoaded(true)
  }, [])

  // Warm the chunk once the browser has nothing better to do, so a visitor who
  // *does* click later gets an instant panel instead of a network wait.
  // …but only once the visitor shows a first sign of life (move, touch, key, scroll). Loading it on its own a few
  // seconds after arrival cost ~500KB of script (the AI SDK and zod) parsed and run right in the busiest moment of the
  // page, for visitors who never open the chat. A click on the bubble still loads it on demand (see below).
  useEffect(() => {
    if (loadedRef.current) return
    let handle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const events = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'scroll'] as const
    const stop = () => events.forEach((e) => window.removeEventListener(e, onSign))
    const onSign = () => {
      stop()
      const idle = window.requestIdleCallback
      if (typeof idle === 'function') handle = idle(() => load(), { timeout: IDLE_TIMEOUT_MS })
      else timer = setTimeout(load, 300)
    }
    events.forEach((e) => window.addEventListener(e, onSign, { passive: true }))
    return () => {
      stop()
      if (handle !== undefined) window.cancelIdleCallback?.(handle)
      if (timer) clearTimeout(timer)
    }
  }, [load])

  // Other pages (e.g. the Offers page's "Request a quote" buttons) open the
  // chat with a pre-filled message. While the widget is still unloaded there
  // is no listener for that event, so the loader picks it up, mounts the
  // widget and hands the text over as a prop. The same goes while the widget is
  // loaded but not yet mounted (the chunk is still arriving): a tap in that window
  // used to be lost. Once mounted, the widget's own listener owns these.
  useEffect(() => {
    return onOpenChatRequest((text) => {
      if (isChatWidgetMounted()) return // the mounted widget answers on its own
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
        <InviteBubble locale={locale} pathname={pathname} onShow={load} />
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
      <InviteBubble locale={locale} pathname={pathname} onShow={load} />
      <ChatWidget autoOpen={autoOpen} initialMessage={pendingMessage} />
    </>
  )
}
