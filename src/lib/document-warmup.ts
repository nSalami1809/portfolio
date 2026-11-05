import { PDFJS_WORKER_URL } from './pdfjs-worker-url'

/** Above this a file is left to the viewer to read page by page (range requests) instead of being downloaded whole up front. */
export const PREFETCH_MAX_BYTES = 8 * 1024 * 1024

/**
 * A tiny script the server puts in the page of a PDF document. It runs while the HTML is still being read, BEFORE any of the
 * page's JavaScript, and asks the browser to start downloading the file and the PDF engine's worker at low priority. On a slow
 * phone the page's own start-up takes seconds of processor time, and the downloads used to wait for it.
 *
 * It applies the same rule as canAutoLoad() (DocumentPreview.tsx): nothing is downloaded on a data saver, a 2G/3G connection or
 * a device with under 2 GB of memory. The two must stay in step (tests/documents-preview-speed.test.ts runs this one).
 */
export function warmupScript(fileUrl: string): string {
  const urls = JSON.stringify([fileUrl, PDFJS_WORKER_URL]).replace(/</g, '\\u003c')
  return (
    '(function(urls){try{var n=navigator,c=n.connection||{};' +
    "if(c.saveData||/^(slow-2g|2g|3g)$/.test(c.effectiveType||'')||(typeof n.deviceMemory==='number'&&n.deviceMemory<2))return;" +
    "urls.forEach(function(u){var l=document.createElement('link');l.rel='preload';l.as='fetch';l.href=u;l.crossOrigin='anonymous';" +
    "l.setAttribute('fetchpriority','low');document.head.appendChild(l)})}catch(e){}})(" + urls + ')'
  )
}
