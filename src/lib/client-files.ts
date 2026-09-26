// Rules for the files a client sends from their tracking page (logo, texts,
// images…): what is accepted, how big, how the name is cleaned. Pure, so the
// route handler stays thin and the rules are unit-tested.
export const MAX_CLIENT_FILE_BYTES = 8 * 1024 * 1024
export const MAX_CLIENT_FILES = 20

// Allow-list on purpose: no SVG (script-capable), HTML, archives with code, or executables.
const ALLOWED: Record<string, string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/plain'],
  csv: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  zip: ['application/zip', 'application/x-zip-compressed'],
}

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED).map((e) => `.${e}`).join(',')

export function cleanFileName(name: string): string {
  const base = (name.split(/[/\\]/).pop() ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^\.+/, '').slice(-100)
  return cleaned || 'fichier'
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

// Returns the content type to store, or an error key.
export function checkClientFile(file: { name: string; type: string; size: number }): { ok: true; contentType: string } | { ok: false; error: 'empty' | 'toolarge' | 'type' } {
  if (file.size <= 0) return { ok: false, error: 'empty' }
  if (file.size > MAX_CLIENT_FILE_BYTES) return { ok: false, error: 'toolarge' }
  const ext = fileExtension(file.name)
  const types = ALLOWED[ext]
  if (!types) return { ok: false, error: 'type' }
  // Browsers sometimes send an empty or generic type: trust the extension then.
  const declared = file.type.toLowerCase()
  if (declared && declared !== 'application/octet-stream' && !types.includes(declared)) return { ok: false, error: 'type' }
  return { ok: true, contentType: types[0] }
}
