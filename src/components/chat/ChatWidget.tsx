'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

function BotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  )
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-4 space-y-1" style={{ listStyle: 'disc' }}>{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-4 space-y-1" style={{ listStyle: 'decimal' }}>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code
      className="text-xs rounded"
      style={{ background: 'var(--surface)', padding: '0.1rem 0.35rem', fontFamily: 'monospace' }}
    >
      {children}
    </code>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded images, unknown aspect ratio
    <img
      src={typeof src === 'string' ? src : undefined}
      alt={alt ?? ''}
      loading="lazy"
      className="rounded-lg mt-1 mb-2"
      style={{ maxWidth: '100%', border: '1px solid var(--border)' }}
    />
  ),
}

export default function ChatWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250)
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    sendMessage({ text })
    setInput('')
  }

  if (pathname?.startsWith('/admin')) return null

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fermer le chat' : 'Ouvrir le chat'}
        aria-expanded={open}
        aria-controls="chat-widget-panel"
        className="fixed bottom-5 right-5 z-40 flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          background: 'var(--accent)',
          boxShadow: '0 8px 30px var(--accent-glow)',
          color: '#fff',
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.svg
              key="close"
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={{ duration: 0.15 }}
              width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </motion.svg>
          ) : (
            <motion.div
              key="bot"
              initial={{ opacity: 0, rotate: 45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -45 }}
              transition={{ duration: 0.15 }}
            >
              <BotIcon width={26} height={26} aria-hidden="true" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="chat-widget-panel"
            role="dialog"
            aria-label="Assistant du portfolio"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed z-40 flex flex-col overflow-hidden"
            style={{
              bottom: 'calc(5rem + 1rem)',
              right: '1.25rem',
              width: 'min(380px, calc(100vw - 2.5rem))',
              height: 'min(560px, calc(100vh - 8rem))',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '1.25rem',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#5B21B6)' }}
                aria-hidden="true"
              >
                <BotIcon width={17} height={17} color="white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                  Assistant du portfolio
                </p>
                <p className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  Questions sur le parcours, les projets…
                </p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div
                  className="rounded-xl px-3.5 py-3 text-sm"
                  style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)', maxWidth: '85%' }}
                >
                  Bonjour ! Posez-moi une question sur le parcours, les projets ou les compétences de Nawaf.
                </div>
              )}
              {messages.map((message) => {
                const isUser = message.role === 'user'
                return (
                  <div key={message.id} className="flex" style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                    <div
                      className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                      style={{
                        maxWidth: '85%',
                        background: isUser ? 'var(--accent-glow)' : 'var(--surface-hover)',
                        border: `1px solid ${isUser ? 'transparent' : 'var(--border)'}`,
                        color: 'var(--text)',
                      }}
                    >
                      {message.parts.map((part, i) => {
                        if (part.type !== 'text') return null
                        if (isUser) return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part.text}</span>
                        return (
                          <div key={i} className="chat-markdown">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                              {part.text}
                            </ReactMarkdown>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {busy && (
                <div className="flex" style={{ justifyContent: 'flex-start' }}>
                  <div
                    className="rounded-xl px-3.5 py-2.5 flex items-center gap-1"
                    style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
                    aria-label="L'assistant écrit…"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="rounded-full"
                        style={{ width: 5, height: 5, background: 'var(--text-subtle)' }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Écrivez votre question…"
                aria-label="Votre message"
                className="input text-sm flex-1"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="Envoyer"
                className="btn-primary btn-sm shrink-0"
                style={{ padding: '0.6rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
