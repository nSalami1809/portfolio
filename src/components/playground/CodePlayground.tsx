'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type OnMount, type OnValidate } from '@monaco-editor/react'
import { useTheme } from '@/hooks/useTheme'
import { runInSandbox, type PlaygroundLogEntry } from '@/lib/playground/runInSandbox'
import type { Dictionary } from '@/lib/i18n/dictionaries'

interface Props {
  t: Dictionary['playground']
}

// Real VS Code chrome colors (Dark+/Light+ default themes) — deliberately
// hardcoded instead of the site's --accent/--surface tokens, same reasoning
// as .liquid-glass in globals.css: this widget is meant to read as an actual
// VS Code window, not a themed site component.
const VS_COLORS = {
  dark: {
    tabBarBg: '#252526',
    activeTabBg: '#1e1e1e',
    activeTabBorder: '#1e1e1e',
    activeTabText: '#ffffff',
    statusBg: '#007acc',
    statusText: '#ffffff',
  },
  light: {
    tabBarBg: '#f3f3f3',
    activeTabBg: '#ffffff',
    activeTabBorder: '#e7e7e7',
    activeTabText: '#333333',
    statusBg: '#007acc',
    statusText: '#ffffff',
  },
} as const

const monoFont = 'Consolas, "Courier New", ui-monospace, SFMono-Regular, Menlo, monospace'

export default function CodePlayground({ t }: Props) {
  const { theme } = useTheme()
  const [code, setCode] = useState(t.starterCode)
  const [output, setOutput] = useState<PlaygroundLogEntry[]>([])
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<'idle' | 'done' | 'error' | 'timeout'>('idle')
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [problems, setProblems] = useState({ errors: 0, warnings: 0 })
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

  // Keeps Ctrl+Enter bound to the latest `run` without re-registering the
  // Monaco command (and losing the closure) on every keystroke.
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => () => cancelRef.current?.(), [])

  const reset = () => {
    cancelRef.current?.()
    setRunning(false)
    setStatus('idle')
    setCode(t.starterCode)
    setOutput([])
  }

  const handleMount: OnMount = (editor, monaco) => {
    editor.onDidChangeCursorPosition((e) => {
      setCursor({ line: e.position.lineNumber, column: e.position.column })
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current())
  }

  const handleValidate: OnValidate = (markers) => {
    setProblems({
      errors: markers.filter((m) => m.severity === 8).length,
      warnings: markers.filter((m) => m.severity === 4).length,
    })
  }

  const c = VS_COLORS[theme]

  return (
    <div className="card overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-end" style={{ background: c.tabBarBg }}>
        <div
          className="flex items-center gap-2 px-3.5 py-2 text-sm"
          style={{
            background: c.activeTabBg,
            color: c.activeTabText,
            borderTop: `2px solid ${c.activeTabBorder}`,
            fontFamily: monoFont,
          }}
        >
          <span aria-hidden="true" style={{ color: '#F0DB4F', fontWeight: 700, fontSize: '0.7rem' }}>JS</span>
          <span>{t.filename}</span>
          <span aria-hidden="true" style={{ opacity: 0.6, marginLeft: 4, fontSize: '0.8rem' }}>×</span>
        </div>
      </div>

      <Editor
        height="360px"
        language="javascript"
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        value={code}
        onChange={(value) => setCode(value ?? '')}
        onMount={handleMount}
        onValidate={handleValidate}
        loading={<div className="loader" style={{ margin: '160px auto' }} aria-hidden="true" />}
        options={{
          fontSize: 14,
          fontFamily: monoFont,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          padding: { top: 12 },
          renderLineHighlight: 'all',
          ariaLabel: t.filename,
        }}
      />

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 text-xs"
        style={{ background: c.statusBg, color: c.statusText, height: 22, fontFamily: 'var(--font-poppins), sans-serif' }}
      >
        <div className="flex items-center gap-3">
          <span>{problems.errors > 0 ? `⊗ ${problems.errors}` : '✓ 0'}</span>
          {problems.warnings > 0 && <span>⚠ {problems.warnings}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span>Ln {cursor.line}, Col {cursor.column}</span>
          <span className="hidden sm:inline">Spaces: 2</span>
          <span className="hidden sm:inline">UTF-8</span>
          <span className="hidden sm:inline">LF</span>
          <span>{'{ } JavaScript'}</span>
        </div>
      </div>

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
