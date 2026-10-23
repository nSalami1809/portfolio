'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import Icon from '@/components/ui/Icon'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastCtx | null>(null)

const ICONS = {
  success: (
    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,128,0,0.15)' }}>
      <Icon name="check" size={11} style={{ color: '#008000' }} />
    </div>
  ),
  error: (
    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(217,0,0,0.15)' }}>
      <Icon name="close" size={11} style={{ color: '#D90000' }} />
    </div>
  ),
  info: (
    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-glow)' }}>
      <Icon name="alert" size={11} style={{ color: 'var(--accent)' }} />
    </div>
  ),
}

const BORDER = {
  success: 'rgba(0,128,0,0.35)',
  error:   'rgba(217,0,0,0.35)',
  info:    'var(--glass-border)',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id])
    setToasts((p) => p.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `t-${++counterRef.current}`
    setToasts((p) => [{ id, message, type }, ...p])
    timers.current[id] = setTimeout(() => dismiss(id), 3500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="fixed right-6 z-[9999] flex flex-col gap-2 pointer-events-none"
        // Clear of the floating assistant button (56 px + its 20 px margin).
        style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))', maxWidth: 'min(360px, calc(100vw - 48px))' }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {toasts.map((t) => (
            <m.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.93, y: 4, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl pointer-events-auto"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${BORDER[t.type]}`,
                boxShadow: 'var(--shadow-md)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              {ICONS[t.type]}
              <p className="text-sm flex-1 leading-snug" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                {t.message}
              </p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Fermer"
                className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Icon name="close" size={10} />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx.toast
}
