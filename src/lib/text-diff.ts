// A small, dependency-free text diff for the "before / after" views of the assistant's
// drafts. Word level for short texts, line level for long ones. Pure.

export type DiffKind = 'same' | 'del' | 'add'
export interface DiffSegment { kind: DiffKind; text: string }

// LCS table size is a * b; beyond this the comparison falls back to a coarser unit.
const MAX_CELLS = 4_000_000

function lcsDiff(a: string[], b: string[]): { kind: DiffKind; value: string }[] {
  const n = a.length
  const m = b.length
  // Trim the common prefix and suffix first: most edits touch a small part of the text.
  let start = 0
  while (start < n && start < m && a[start] === b[start]) start++
  let endA = n
  let endB = m
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }

  const out: { kind: DiffKind; value: string }[] = []
  for (let i = 0; i < start; i++) out.push({ kind: 'same', value: a[i] })

  const A = a.slice(start, endA)
  const B = b.slice(start, endB)
  const w = B.length + 1
  const table = new Uint32Array((A.length + 1) * w)
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      table[i * w + j] = A[i] === B[j] ? table[(i + 1) * w + j + 1] + 1 : Math.max(table[(i + 1) * w + j], table[i * w + j + 1])
    }
  }
  let i = 0
  let j = 0
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out.push({ kind: 'same', value: A[i] }); i++; j++ }
    else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) { out.push({ kind: 'del', value: A[i] }); i++ }
    else { out.push({ kind: 'add', value: B[j] }); j++ }
  }
  while (i < A.length) out.push({ kind: 'del', value: A[i++] })
  while (j < B.length) out.push({ kind: 'add', value: B[j++] })

  for (let k = endA; k < n; k++) out.push({ kind: 'same', value: a[k] })
  return out
}

function merge(parts: { kind: DiffKind; value: string }[]): DiffSegment[] {
  const out: DiffSegment[] = []
  for (const p of parts) {
    const last = out[out.length - 1]
    if (last && last.kind === p.kind) last.text += p.value
    else out.push({ kind: p.kind, text: p.value })
  }
  return out
}

const words = (s: string) => s.match(/\s+|[^\s]+/g) ?? []
const lines = (s: string) => s.match(/[^\n]*\n|[^\n]+$/g) ?? []

/** Word-level diff; falls back to lines when the texts are too long to compare word by word. */
export function diffText(before: string, after: string): DiffSegment[] {
  if (before === after) return before ? [{ kind: 'same', text: before }] : []
  const wa = words(before)
  const wb = words(after)
  if (wa.length * wb.length <= MAX_CELLS) return merge(lcsDiff(wa, wb))
  const la = lines(before)
  const lb = lines(after)
  return merge(lcsDiff(la, lb))
}

export interface DiffStats { added: number; removed: number; changed: boolean }

/** Word counts of what was added and removed, for the "3 mots ajoutés, 5 retirés" summary. */
export function diffStats(segments: DiffSegment[]): DiffStats {
  let added = 0
  let removed = 0
  for (const s of segments) {
    const count = (s.text.match(/[^\s]+/g) ?? []).length
    if (s.kind === 'add') added += count
    if (s.kind === 'del') removed += count
  }
  return { added, removed, changed: added > 0 || removed > 0 }
}
