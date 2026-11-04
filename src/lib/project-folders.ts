import type { Project } from '@/types'

// A folder only needs these fields of a project.
export type FolderProject = Pick<Project, 'slug' | 'title' | 'category' | 'image'>

export interface Folder {
  category: string
  /** Every project of the category, not only the ones shown in the fan */
  count: number
  /** At most MAX_COVERS projects, pictured ones first, otherwise in the order of the list */
  covers: { slug: string; title: string; image?: string }[]
}

export const MAX_COVERS = 3

/**
 * One folder per category, in the order the categories first appear. A folder with a single project is still a
 * folder; the page only shows the section when there are at least two categories to tell apart (see MIN_FOLDERS).
 */
export function groupFolders(projects: FolderProject[]): Folder[] {
  const byCategory = new Map<string, FolderProject[]>()
  for (const p of projects) {
    const category = p.category.trim()
    if (!category) continue
    byCategory.set(category, [...(byCategory.get(category) ?? []), p])
  }
  return [...byCategory].map(([category, list]) => {
    const pictured = list.filter((p) => p.image)
    const plain = list.filter((p) => !p.image)
    return {
      category,
      count: list.length,
      covers: [...pictured, ...plain].slice(0, MAX_COVERS).map((p) => ({ slug: p.slug, title: p.title, image: p.image || undefined })),
    }
  })
}

/** Below this many categories a row of folders would only repeat the list, so it is not shown. */
export const MIN_FOLDERS = 2

/** Where a card of the fan goes when the folder is open: sideways, up, and its tilt (in px and degrees, before scaling). */
export function fanPose(index: number, total: number): { x: number; y: number; r: number } {
  const poses: Record<number, { x: number; y: number; r: number }[]> = {
    1: [{ x: 0, y: -60, r: 0 }],
    2: [{ x: -34, y: -54, r: -8 }, { x: 34, y: -54, r: 8 }],
    3: [{ x: -58, y: -52, r: -12 }, { x: 0, y: -62, r: 0 }, { x: 58, y: -52, r: 12 }],
  }
  const set = poses[Math.min(Math.max(total, 1), MAX_COVERS)]
  return set[Math.min(Math.max(index, 0), set.length - 1)]
}

/** "{n} projets" / "{n} projet": the two forms come from the dictionary, so each language keeps its own plural. */
export function countLabel(n: number, one: string, many: string): string {
  return (n === 1 ? one : many).replace('{n}', String(n))
}
