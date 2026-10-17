import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests only exercise pure code (business rules, document wording, PDFs,
// hashing, tracking) — never the database, Next, or the network.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `import 'server-only'` is handled by Next at build time; tests that reach
      // a server-only module need a harmless stand-in.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
