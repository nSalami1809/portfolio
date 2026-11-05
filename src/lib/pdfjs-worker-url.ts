// The URL of the PDF engine's worker. It carries the pdf.js version (set in next.config.ts from the installed package, the
// same one scripts/copy-pdfjs-worker.mjs copies), so the file can be cached for a year without a visitor ever running an old
// worker against a new library. Kept apart from pdfjs-worker.ts so the document page can start downloading it early without
// pulling the whole PDF library into its own bundle.
export const PDFJS_WORKER_URL = `/pdfjs/pdf.worker.min.mjs?v=${process.env.NEXT_PUBLIC_PDFJS_VERSION ?? 'dev'}`
