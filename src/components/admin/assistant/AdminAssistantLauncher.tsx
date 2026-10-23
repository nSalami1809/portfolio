'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { BotIcon } from '@/components/chat/BotIcon'
import ChatPane from '@/components/admin/assistant/ChatPane'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { getAssistantStatus } from '@/actions/assistant'
import { getDailyBriefing } from '@/actions/briefing'
import { pageKeyForPath } from '@/lib/assistant/page-context'
import { OPEN_ROBOT_EVENT } from '@/components/admin/CommandPalette'
import Icon from '@/components/ui/Icon'

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`)

// The robot of the front office, in the back-office: a floating button that opens
// the assistant from any admin page. The conversation lives as long as the admin
// layout does, so it follows you from page to page. Hidden on the assistant page
// itself, which is the same chat at full size.
export default function AdminAssistantLauncher() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  const [conversationId, setConversationId] = useState(newId)
  const [blocked, setBlocked] = useState(false)
  const [briefingSummary, setBriefingSummary] = useState<string | null>(null)

  const refreshStatus = useCallback(() => {
    getAssistantStatus().then((s) => setBlocked(!s.enabled || Boolean(s.modelError) || s.paused), () => undefined)
  }, [])

  useEffect(() => { if (open) refreshStatus() }, [open, refreshStatus])

  // The briefing line under the greeting: computed by the code, no model request.
  useEffect(() => {
    if (!open) return
    getDailyBriefing().then((b) => setBriefingSummary(b.summary), () => undefined)
  }, [open])

  // The command palette (Ctrl+K) can ask the robot to open, from any back-office page. On the
  // assistant page itself (where the robot is hidden) it focuses the message box instead.
  useEffect(() => {
    const onOpen = () => {
      if (pathname === '/admin/assistant') {
        document.getElementById('assistant-input-page')?.focus()
        return
      }
      setOpen(true)
      setEverOpened(true)
    }
    window.addEventListener(OPEN_ROBOT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_ROBOT_EVENT, onOpen)
  }, [pathname])

  const close = useCallback(() => setOpen(false), [])
  useEscapeKey(open, close)

  if (pathname === '/admin/assistant') return null

  const toggle = () => { setOpen((v) => !v); setEverOpened(true) }

  return (
    <>
      <m.button
        type="button"
        onClick={toggle}
        aria-label={open ? "Fermer NemCopilotIA" : "Ouvrir NemCopilotIA"}
        aria-expanded={open}
        aria-controls="admin-assistant-panel"
        className="fixed right-5 z-40 flex items-center justify-center bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
        style={{ width: 56, height: 56, background: 'var(--accent)', boxShadow: '0 8px 30px var(--accent-glow)', color: 'var(--accent-contrast)' }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        {open ? (
          <Icon name="close" size={22} />
        ) : (
          <BotIcon width={26} height={26} aria-hidden="true" />
        )}
      </m.button>

      <AnimatePresence>
        {open && (
          <m.div
            id="admin-assistant-panel"
            role="dialog"
            aria-label="NemCopilotIA"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed z-40 flex flex-col overflow-hidden bottom-[calc(9rem+env(safe-area-inset-bottom))] lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
            style={{
              right: '1.25rem',
              width: 'min(calc(100vw - 2.5rem), 420px)', height: 'min(calc(100dvh - 8rem), 640px)',
              background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="w-7 h-7 flex items-center justify-center" style={{ background: 'var(--brand, var(--accent))', color: 'var(--brand-contrast, var(--accent-contrast))' }} aria-hidden="true"><BotIcon width={17} height={17} /></span>
              <span className="font-display font-semibold text-sm flex-1" style={{ color: 'var(--text)' }}>NemCopilotIA</span>
              <button type="button" className="btn-secondary btn-xs" onClick={() => setConversationId(newId())}>Nouveau</button>
              <Link href="/admin/assistant" onClick={close} className="btn-secondary btn-xs">Ouvrir en grand</Link>
              <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5" style={{ border: '1px solid var(--border)', color: 'var(--text-subtle)' }} title="La palette Ctrl K ouvre aussi NemCopilotIA">Ctrl K</kbd>
            </div>
            {everOpened && (
              <ChatPane
                key={conversationId}
                conversationId={conversationId}
                initialMessages={[]}
                variant="popover"
                blocked={blocked}
                briefingSummary={briefingSummary}
                contextKey={pageKeyForPath(pathname)}
                onTurnFinished={refreshStatus}
                onOpenDraft={(id) => { close(); router.push(`/admin/assistant?draft=${encodeURIComponent(id)}`) }}
              />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
