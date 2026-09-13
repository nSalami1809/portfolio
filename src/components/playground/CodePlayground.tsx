'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode'
import { EditorView } from '@codemirror/view'
import { useTheme } from '@/hooks/useTheme'
import { runInSandbox, type PlaygroundLogEntry } from '@/lib/playground/runInSandbox'
import type { Dictionary } from '@/lib/i18n/dictionaries'

interface Props {
  t: Dictionary['playground']
}

const jsLang = javascript()
// Editor chrome only (gutters, cursor, selection) — syntax colors come from
// the vscode theme below. Font matches the system monospace stack already
// used for inline code elsewhere on the site, so no extra webfont is loaded.
const editorTheme = EditorView.theme({
  '&': { fontSize: '13px' },
  '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', padding: '12px 0' },
  '.cm-gutters': { border: 'none' },
})

export default function CodePlayground({ t }: Props) {
  const { theme } = useTheme()
  const [code, setCode] = useState(t.starterCode)
  const [output, setOutput] = useState<PlaygroundLogEntry[]>([])
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<'idle' | 'done' | 'error' | 'timeout'>('idle')
  const cancelRef = useRef<(() => void) | null>(null)

  const run = useCallback(() => {
    cancelRef.current?.()
    setOutput([])
    setStatus('idle')
    setRunning(true)
    cancelRef.current = runInSandbox(code, {
      onLog: (entry) => setOutput((prev) => [...prev, entry]),
      onDone: () => { setRunning(false); setStatus('done') },
      onError: (message) => {
        setRunning(false)
        setStatus('error')
        setOutput((prev) => [...prev, { level: 'error', text: message }])
      },
      onTimeout: () => {
        setRunning(false)
        setStatus('timeout')
        setOutput((prev) => [...prev, { level: 'error', text: t.timeoutMessage }])
      },
    })
  }, [code, t.timeoutMessage])

  useEffect(() => () => cancelRef.current?.(), [])

  const reset = () => {
    cancelRef.current?.()
    setRunning(false)
    setStatus('idle')
    setCode(t.starterCode)
    setOutput([])
  }

  return (
    <div className="card overflow-hidden">
      {/* Title bar — VS Code style traffic lights + filename */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--glass-border)' }}
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#D90000' }} aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#F59E0B' }} aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#008000' }} aria-hidden="true" />
        <span
          className="ml-2 text-xs"
          style={{ color: 'var(--text-subtle)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
        >
          {t.filename}
        </span>
      </div>

      <CodeMirror
        value={code}
        onChange={setCode}
        theme={theme === 'dark' ? vscodeDark : vscodeLight}
        extensions={[jsLang, editorTheme]}
        basicSetup={{ foldGutter: false }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            run()
          }
        }}
        aria-label={t.filename}
      />

      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
        style={{ borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}
      >
        <div className="flex items-center gap-2">
          <button onClick={run} disabled={running} className="btn-primary !px-4 !py-2 text-sm">
            {running ? (
              <span
                className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'currentColor' }}
                aria-hidden="true"
              />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            )}
            {running ? t.running : t.run}
          </button>
          <button onClick={reset} disabled={running} className="btn-secondary !px-4 !py-2 text-sm">
            {t.reset}
          </button>
          {status !== 'idle' && !running && (
            <span
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: status === 'done' ? '#008000' : '#D90000', fontFamily: 'var(--font-poppins)' }}
            >
              {status === 'done' ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
              {status === 'done' ? t.statusDone : t.statusError}
            </span>
          )}
        </div>
        <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
          {t.shortcutHint}
        </span>
      </div>

      {/* Output console */}
      <div className="px-4 py-3">
        <p
          className="text-xs font-semibold mb-2 tracking-wide uppercase"
          style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}
        >
          {t.outputLabel}
        </p>
        <div
          className="p-3 text-sm overflow-auto"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            minHeight: '96px',
            maxHeight: '280px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
          role="log"
          aria-live="polite"
        >
          {output.length === 0 ? (
            <p style={{ color: 'var(--text-subtle)' }}>{t.outputEmpty}</p>
          ) : (
            output.map((entry, i) => (
              <div
                key={i}
                className="whitespace-pre-wrap break-words"
                style={{ color: entry.level === 'error' ? '#D90000' : entry.level === 'warn' ? '#F59E0B' : 'var(--text)' }}
              >
                {entry.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
