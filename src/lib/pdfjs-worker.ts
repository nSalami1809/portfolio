import { pdfjs } from 'react-pdf'

// Self-hosted (public/pdfjs/, copied at install time by
// scripts/copy-pdfjs-worker.mjs) rather than fetched from a CDN — same
// reasoning as Monaco's assets. Centralized here since both the public PDF
// preview and the admin thumbnail generator need it configured identically.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'

export { pdfjs }
