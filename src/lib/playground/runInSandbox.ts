// Runs visitor-typed JS in a dedicated Worker — its own thread, no DOM/cookie
// access — so a runaway `while(true)` freezes only that worker, never the
// page, and we can hard-kill it after a timeout without any server round-trip.
// This never touches the backend: it's the same trust boundary as a visitor
// typing into their own browser DevTools console, not a new attack surface.

export type PlaygroundLogLevel = 'log' | 'warn' | 'error'
export interface PlaygroundLogEntry {
  level: PlaygroundLogLevel
  text: string
}

interface RunCallbacks {
  onLog: (entry: PlaygroundLogEntry) => void
  onDone: () => void
  onError: (message: string) => void
  onTimeout: () => void
}

const DEFAULT_TIMEOUT_MS = 3000

const RUNNER_SOURCE = `
function stringify(v) {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.stack || v.message
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}
function send(level) {
  return function(...args) {
    self.postMessage({ type: 'log', level, text: args.map(stringify).join(' ') })
  }
}
const console = { log: send('log'), info: send('log'), warn: send('warn'), error: send('error') }

self.onmessage = async (e) => {
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const run = new AsyncFunction('console', e.data)
    await run(console)
    self.postMessage({ type: 'done' })
  } catch (err) {
    self.postMessage({ type: 'error', text: err && err.message ? err.message : String(err) })
  }
}
`

export function runInSandbox(code: string, callbacks: RunCallbacks, timeoutMs = DEFAULT_TIMEOUT_MS): () => void {
  const blob = new Blob([RUNNER_SOURCE], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  const worker = new Worker(url)
  let settled = false

  const cleanup = () => {
    URL.revokeObjectURL(url)
    worker.terminate()
  }

  const timer = setTimeout(() => {
    if (settled) return
    settled = true
    cleanup()
    callbacks.onTimeout()
  }, timeoutMs)

  worker.onmessage = (e: MessageEvent) => {
    if (settled) return
    const data = e.data as { type: 'log' | 'done' | 'error'; level?: PlaygroundLogLevel; text?: string }
    if (data.type === 'log') {
      callbacks.onLog({ level: data.level ?? 'log', text: data.text ?? '' })
      return
    }
    settled = true
    clearTimeout(timer)
    cleanup()
    if (data.type === 'done') callbacks.onDone()
    else callbacks.onError(data.text ?? 'Erreur inconnue')
  }

  worker.onerror = (e: ErrorEvent) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    cleanup()
    callbacks.onError(e.message)
  }

  worker.postMessage(code)

  return () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    cleanup()
  }
}
