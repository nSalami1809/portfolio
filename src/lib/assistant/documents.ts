// Fetching and reading the documents the site publishes (CV, case studies,
// guides…), for the assistant to summarize. Only files already public on the site
// are ever read: the URL must point at the project's own Blob store, over HTTPS,
// with no redirect followed and a size ceiling — so this can never be turned into
// a way to make the server fetch an arbitrary address.
import JSZip from 'jszip'

export const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024
export const MAX_DOCX_TEXT_CHARS = 60_000
const FETCH_TIMEOUT_MS = 15_000
const MAX_UNZIPPED_BYTES = 25 * 1024 * 1024

// <store>.public.blob.vercel-storage.com — one label, nothing in front of or after it.
const BLOB_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i

export function isAllowedDocumentUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  return url.protocol === 'https:' && !url.username && !url.password && url.port === '' && BLOB_HOST.test(url.hostname)
}

export type FetchResult = { ok: true; bytes: Uint8Array } | { ok: false; error: string }

export async function fetchDocumentBytes(
  raw: string,
  opts: { fetchImpl?: typeof fetch; maxBytes?: number; timeoutMs?: number } = {},
): Promise<FetchResult> {
  if (!isAllowedDocumentUrl(raw)) return { ok: false, error: "Adresse du document non autorisée (seuls les fichiers du stockage du site sont lus)." }
  const maxBytes = opts.maxBytes ?? MAX_DOCUMENT_BYTES
  const doFetch = opts.fetchImpl ?? fetch
  try {
    // redirect: 'manual' — a redirect could lead anywhere, so it is refused, not followed.
    const res = await doFetch(raw, { redirect: 'manual', signal: AbortSignal.timeout(opts.timeoutMs ?? FETCH_TIMEOUT_MS) })
    if (res.status >= 300 && res.status < 400) return { ok: false, error: 'Le document est redirigé : lecture refusée.' }
    if (!res.ok || !res.body) return { ok: false, error: `Le document est inaccessible (HTTP ${res.status}).` }
    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared > maxBytes) return { ok: false, error: `Document trop volumineux (maximum ${Math.round(maxBytes / 1024 / 1024)} Mo).` }

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, error: `Document trop volumineux (maximum ${Math.round(maxBytes / 1024 / 1024)} Mo).` }
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength }
    return { ok: true, bytes }
  } catch {
    return { ok: false, error: 'Impossible de récupérer le document (délai dépassé ou erreur réseau).' }
  }
}

const decodeEntities = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&')

/** Plain text of a .docx (body only), or null if it is not a readable Word file. */
export async function docxToText(bytes: Uint8Array): Promise<string | null> {
  try {
    const zip = await JSZip.loadAsync(bytes)
    const entry = zip.file('word/document.xml')
    if (!entry) return null
    // A small archive can expand enormously ("zip bomb"): look at the declared size first.
    const declared = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
    if (typeof declared === 'number' && declared > MAX_UNZIPPED_BYTES) return null
    const xml = await entry.async('string')
    const text = decodeEntities(
      xml
        .replace(/<w:tab\b[^>]*\/>/g, '\t')
        .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, ''),
    )
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return text.slice(0, MAX_DOCX_TEXT_CHARS)
  } catch {
    return null
  }
}
