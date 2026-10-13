// Serves the pdf.js worker (used by the Documents preview, via react-pdf)
// from our own origin instead of fetching it from a CDN at runtime — same
// pattern as scripts/copy-monaco-assets.mjs. Runs on every `npm install`
// (local and on Vercel) since node_modules is guaranteed to exist by then;
// the copied output isn't committed (see .gitignore).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const destDir = join(root, 'public', 'pdfjs')
const dest = join(destDir, 'pdf.worker.min.mjs')

if (!existsSync(src)) {
  console.warn('[copy-pdfjs-worker] pdfjs-dist/build/pdf.worker.min.mjs not found, skipping')
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })
copyFileSync(src, dest)
console.log('[copy-pdfjs-worker] copied to public/pdfjs/pdf.worker.min.mjs')
