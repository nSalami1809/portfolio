import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', 'src')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const css = read('app/globals.css')

// The two blocks that define the tokens: the light :root and the .dark override.
const light = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'))
const dark = css.slice(css.indexOf('.dark {'), css.indexOf('@theme inline'))
const token = (block: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1].trim()

const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
const luminance = (hex: string) => { const h = hex.replace('#', ''); const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

describe('the coral brand colour', () => {
  it('is defined in light and dark, next to (never in place of) the black-and-white accent', () => {
    expect(token(light, '--brand')).toBe('#C2410C')
    expect(token(dark, '--brand')).toBe('#FB923C')
    expect(token(light, '--accent')).toBe('#111111')
    expect(token(dark, '--accent')).toBe('#FFFFFF')
    for (const name of ['--brand-soft', '--brand-line', '--brand-contrast']) {
      expect(token(light, name), `${name} (light)`).toBeTruthy()
      expect(token(dark, name), `${name} (dark)`).toBeTruthy()
    }
    expect(css).toContain('--color-brand: var(--brand)')
  })

  it('reads as text on the page background, and the text on a brand fill reads too (WCAG AA, 4.5:1)', () => {
    expect(ratio(token(light, '--brand')!, token(light, '--bg')!)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(token(dark, '--brand')!, token(dark, '--bg')!)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(token(light, '--brand')!, token(light, '--brand-contrast')!)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(token(dark, '--brand')!, token(dark, '--brand-contrast')!)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the "attention" colour a yellow-gold, apart from the coral, in light and dark', () => {
    expect(token(light, '--warn')).toBe('#A16207')
    expect(token(dark, '--warn')).toBe('#FACC15')
    expect(ratio(token(light, '--warn')!, token(light, '--bg')!)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(token(dark, '--warn')!, token(dark, '--bg')!)).toBeGreaterThanOrEqual(4.5)
    expect(readFileSync(join(ROOT, 'app/admin/chats/page.tsx'), 'utf8')).not.toContain('#D97706')
  })

  it('colours focus, selection, labels and form focus, and only those globally', () => {
    expect(css).toMatch(/:focus-visible\s*{[^}]*var\(--brand\)/)
    expect(css).toMatch(/::selection\s*{[^}]*var\(--brand\)/)
    expect(css).toMatch(/\.section-label\s*{[^}]*color:\s*var\(--brand\)/)
    expect(css).toMatch(/\.input:focus\s*{[^}]*var\(--brand\)/)
    // main buttons stay black and white
    expect(css).toMatch(/\.btn-primary\s*{\s*background:\s*var\(--accent\)/)
  })
})

describe('NemCopilotIA\'s mark', () => {
  const icon = read('components/chat/BotIcon.tsx')
  const stub = read('components/chat/ChatWidgetLoader.tsx')

  it('is the Hugeicons ChatBot robot the owner picked, from the free pack already used by the site', () => {
    for (const [name, source] of [['BotIcon', icon], ['loader stub', stub]] as const) {
      expect(source, name).toContain("import { ChatBotIcon } from '@hugeicons/core-free-icons'")
      expect(source, name).toMatch(/icon=\{ChatBotIcon\}/)
    }
  })

  it('draws the same robot, with the same line weight, in the animated icon and in the lightweight stub', () => {
    expect(icon).toMatch(/BOT_STROKE_WIDTH = 1\.5/)
    expect(icon).toMatch(/strokeWidth=\{BOT_STROKE_WIDTH\}/)
    expect(stub).toMatch(/strokeWidth=\{1\.5\}/)
  })

  it('replaces the star of NemCopilotIA in the back-office menus (sidebar and phone bar) by the same robot', () => {
    const layout = read('app/admin/layout.tsx')
    const bar = read('components/admin/MobileBottomNav.tsx')
    expect(layout).toMatch(/label: 'NemCopilotIA', icon: <HugeiconsIcon icon=\{ChatBotIcon\}/)
    expect(bar).toContain('icon={ChatBotIcon}')
    expect(`${layout}${bar}`).not.toContain('M12 3l1.9 5.1')
  })

  it('uses Hugeicons icons, with an accessible name, for copy and regenerate in the assistant chat', () => {
    const chat = read('components/admin/assistant/ChatPane.tsx')
    expect(chat).toContain("import { Copy01Icon, RefreshIcon, Tick02Icon } from '@hugeicons/core-free-icons'")
    expect(chat).toMatch(/aria-label="Copier la réponse"/)
    expect(chat).toMatch(/aria-label="Régénérer la réponse"/)
    expect(chat).not.toMatch(/>Copier<|>Régénérer</)
  })

  it('never carries a rounded container of its own: the robot always sits on a square', () => {
    expect(icon).not.toMatch(/rounded|borderRadius|border-radius/)
    expect(stub).not.toMatch(/rounded-full|borderRadius/)
  })

  it('is worn on a coral square by the public chat and by the assistant', () => {
    const square = "background: 'var(--brand, var(--accent))', color: 'var(--brand-contrast, var(--accent-contrast))'"
    expect(icon).toContain(square)
    expect(read('components/admin/assistant/ChatPane.tsx')).toContain(square)
    expect(read('components/admin/assistant/AdminAssistantLauncher.tsx')).toContain(square)
  })
})

describe('the colour never makes a control vanish', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
  const sources = walk(ROOT).filter((p) => p.endsWith('.tsx')).map((p) => ({ p: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') }))

  it('uses the brand tokens only with a black-and-white fallback, so an old stylesheet still shows borders and fills', () => {
    for (const { p, text } of sources) {
      expect(text, `${p}: bare var(--brand)`).not.toMatch(/var\(--brand\)/)
      expect(text, `${p}: bare var(--brand-soft)`).not.toMatch(/var\(--brand-soft\)/)
      expect(text, `${p}: bare var(--brand-contrast)`).not.toMatch(/var\(--brand-contrast\)/)
    }
  })

  it('makes "Back" and "Talk to Nawaf" real buttons with an arrow, in the public chat', () => {
    const panels = read('components/chat/ChatPanels.tsx')
    const widget = read('components/chat/ChatWidget.tsx')
    expect(panels).toContain('icon={ArrowLeft01Icon}')
    expect(panels).not.toMatch(/className="text-xs underline"[^>]*>\{t\.back\}/)
    expect(widget).toMatch(/data-testid="chat-talk"[\s\S]*?btn-secondary|btn-secondary[\s\S]*?data-testid="chat-talk"/)
    expect(widget).toContain('icon={ArrowRight01Icon}')
  })
})
