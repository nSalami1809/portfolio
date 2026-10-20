'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { searchQuotesForPalette } from '@/actions/quotes'
import { buildEntries, moveIndex, type PaletteEntry, type PalettePage, type PaletteQuote } from '@/lib/admin-palette'

export const OPEN_ROBOT_EVENT = 'nemcopilot:open'
export const OPEN_PALETTE_EVENT = 'nemcopilot:palette'

const KIND_LABEL: Record<PaletteEntry['kind'], string> = { ask: 'IA', robot: 'IA', page: 'Page', quote: 'Devis' }

// Ctrl/Cmd+K anywhere in the back-office: jump to a page or a quote, or hand a question to
// NemCopilotIA (it arrives in the composer, never sent for you). Only reads: the quote
// search returns five lines of text and the pages come from the menu.
export default function CommandPalette({ pages }: { pages: PalettePage[] }) {
  const router = useRouter()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [quotes, setQuotes] = useState<PaletteQuote[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { Promise.resolve().then(() => setMounted(true)) }, [])

  const close = useCallback(() => { setOpen(false); setQuery(''); setQuotes([]); setActive(0) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_PALETTE_EVENT, onOpen) }
  }, [])

  useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()) }, [open])

  // Quotes: searched a moment after the last keystroke, results of an older query ignored.
  useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (term.length < 2) { const id = setTimeout(() => setQuotes([]), 0); return () => clearTimeout(id) }
    let stale = false
    const id = setTimeout(() => {
      searchQuotesForPalette(term).then((r) => { if (!stale) setQuotes(r) }, () => { if (!stale) setQuotes([]) })
    }, 180)
    return () => { stale = true; clearTimeout(id) }
  }, [query, open])

  const entries = useMemo(() => buildEntries(query, pages, quotes), [query, pages, quotes])
  const current = Math.min(active, Math.max(0, entries.length - 1))

  const choose = (entry: PaletteEntry) => {
    close()
    if (entry.kind === 'robot') window.dispatchEvent(new CustomEvent(OPEN_ROBOT_EVENT))
    else router.push(entry.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(moveIndex(current, 1, entries.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(moveIndex(current, -1, entries.length)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (entries[current]) choose(entries[current]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-2.5 h-8 text-xs transition-colors hover:bg-[var(--surface-hover)]"
        style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
        aria-label="Rechercher et lancer une action (Ctrl K)"
        data-testid="palette-trigger"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <span className="hidden sm:inline">Rechercher</span>
        <kbd className="hidden sm:inline text-[10px] px-1" style={{ border: '1px solid var(--border)' }}>Ctrl K</kbd>
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[10vh]" role="presentation" style={{ background: 'rgba(0,0,0,0.5)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
          <div role="dialog" aria-modal="true" aria-label="Recherche et commandes" className="w-full max-w-xl flex flex-col" style={{ background: 'var(--bg)', border: '1px solid var(--brand)', boxShadow: '6px 6px 0 var(--brand)', maxHeight: '70dvh' }} data-testid="palette">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              onKeyDown={onKeyDown}
              placeholder="Une page, un devis, ou une question pour NemCopilotIA…"
              aria-label="Rechercher"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={entries[current] ? `${listId}-${current}` : undefined}
              autoComplete="off"
              spellCheck={false}
              maxLength={200}
              className="w-full bg-transparent outline-none px-4 py-3.5 text-sm"
              style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-poppins)' }}
            />
            <ul id={listId} role="listbox" aria-label="Résultats" className="overflow-y-auto py-1">
              {entries.map((entry, i) => {
                const on = i === current
                return (
                  <li
                    key={entry.id} id={`${listId}-${i}`} role="option" aria-selected={on}
                    onMouseEnter={() => setActive(i)} onClick={() => choose(entry)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                    style={{ background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--accent-contrast)' : 'var(--text)', fontFamily: 'var(--font-poppins)' }}
                  >
                    <span className="text-[10px] font-bold tracking-wider uppercase w-10 flex-shrink-0" style={{ opacity: 0.65 }}>{KIND_LABEL[entry.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm truncate">{entry.label}</span>
                      <span className="block text-xs truncate" style={{ opacity: 0.65 }}>{entry.hint}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="px-4 py-2 text-[11px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
              ↑ ↓ pour naviguer · Entrée pour ouvrir · Échap pour fermer
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
