// Serves the Monaco Editor AMD bundle (used by the /playground page) from
// our own origin instead of the @monaco-editor/react default of fetching it
// from a CDN at runtime — same-origin + Vercel's static caching is faster
// and doesn't depend on a third party being reachable. Runs on every
// `npm install` (local and on Vercel) since node_modules is guaranteed to
// exist by then; the copied output isn't committed (see .gitignore).
import { cpSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'node_modules', 'monaco-editor', 'min', 'vs')
const dest = join(root, 'public', 'monaco-editor', 'vs')

if (!existsSync(src)) {
  console.warn('[copy-monaco-assets] monaco-editor/min/vs not found, skipping')
  process.exit(0)
}

cpSync(src, dest, { recursive: true })
console.log('[copy-monaco-assets] copied to public/monaco-editor/vs')
