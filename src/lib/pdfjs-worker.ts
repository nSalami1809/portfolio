import { pdfjs } from 'react-pdf'
import { PDFJS_WORKER_URL } from './pdfjs-worker-url'

// Self-hosted (public/pdfjs/, copied at install time by
// scripts/copy-pdfjs-worker.mjs) rather than fetched from a CDN — same
// reasoning as Monaco's assets. Centralized here since both the public PDF
// preview and the admin thumbnail generator need it configured identically.
// The URL carries the pdf.js version (see pdfjs-worker-url.ts), so the file is cached for a year (next.config.ts).
pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL

export { pdfjs }
