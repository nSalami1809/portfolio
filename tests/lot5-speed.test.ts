import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')

describe('start-up cost of the chat', () => {
  const loader = read('src', 'components', 'chat', 'ChatWidgetLoader.tsx')

  it('does not preload the chat (AI SDK + zod, ~500KB of script) on its own after arrival', () => {
    expect(loader).not.toMatch(/idle\(\(\) => load\(\), \{ timeout: IDLE_TIMEOUT_MS \}\)\s*\n\s*return \(\) => window\.cancelIdleCallback/)
    expect(loader).toContain("const events = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'scroll'] as const")
    expect(loader).toContain('events.forEach((e) => window.addEventListener(e, onSign, { passive: true }))')
  })

  it('still loads it on demand: on the first sign of life, on a tap on the bubble, or when a page asks to open it', () => {
    expect(loader).toContain('onClick={() => {')
    expect(loader).toContain('onOpenChatRequest')
    expect(loader).toContain('setAutoOpen(true)')
  })

  it('gets the chat ready when the invitation appears, so a tap on one of its questions answers at once', () => {
    expect(loader).toContain('onShow() //')
    expect(loader).toContain('onShow={load}')
  })

  it('never loses a request to open the chat that arrives while the chat is still downloading', () => {
    const bridge = read('src', 'lib', 'chat-bridge.ts')
    expect(bridge).toContain('export function isChatWidgetMounted()')
    expect(loader).toContain('if (isChatWidgetMounted()) return')
    expect(loader).not.toMatch(/if \(loadedRef\.current\) return\s+setPendingMessage/)
    const widget = read('src', 'components', 'chat', 'ChatWidget.tsx')
    expect(widget).toContain('setChatWidgetMounted(true)')
    expect(widget).toContain('setChatWidgetMounted(false)')
  })

  it('cleans up its listeners and its pending idle callback', () => {
    expect(loader).toContain('events.forEach((e) => window.removeEventListener(e, onSign))')
    expect(loader).toContain('window.cancelIdleCallback?.(handle)')
  })
})

describe('platform scripts', () => {
  it('Vercel Analytics is only mounted on Vercel (elsewhere its script is a 404 shown as a console error)', () => {
    const layout = read('src', 'app', 'layout.tsx')
    expect(layout).toContain('{process.env.VERCEL ? <Analytics /> : null}')
    expect(read('src', 'components', 'analytics', 'SpeedInsights.tsx')).toContain('if (!process.env.VERCEL) return null')
  })
})

describe('first paint', () => {
  it('keeps the stylesheet as a separate file: inlining it measured ~300ms slower to first paint (A/B, same pages)', () => {
    expect(read('next.config.ts')).not.toMatch(/^\s*inlineCss:\s*true/m)
  })
})
