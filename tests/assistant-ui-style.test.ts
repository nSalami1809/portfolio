import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// The site's design language is square: cards, buttons, the front office's robot
// button. The assistant's screens follow it, so no rounded shape may come back —
// not a Tailwind radius class (rounded-full and arbitrary radii are NOT neutralised
// by the theme's radius tokens), not an inline border-radius.
const ROOT = join(__dirname, '..', 'src')
const dir = join(ROOT, 'components', 'admin', 'assistant')
const files = [
  ...readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => ({ name: `components/admin/assistant/${f}`, path: join(dir, f) })),
  { name: 'app/admin/assistant/page.tsx', path: join(ROOT, 'app', 'admin', 'assistant', 'page.tsx') },
]

describe('the assistant UI keeps the site\'s square corners', () => {
  it('covers the whole assistant interface', () => {
    expect(files.length).toBeGreaterThanOrEqual(7)
  })

  it.each(files.map((f) => [f.name, f.path]))('%s has no rounded shape', (_name, path) => {
    const source = readFileSync(path, 'utf8')
    expect(source).not.toMatch(/\brounded\b|\brounded-|borderRadius|border-radius/)
  })

  it('has no stray double space left in a class list', () => {
    for (const f of files) expect(readFileSync(f.path, 'utf8'), f.name).not.toMatch(/className="\s|\s\s+[a-z-]+[^"]*"\s/)
  })
})
