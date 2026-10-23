// Pictures of a project: the cover (`image`) first, then `gallery`, six in all.
// Pure helpers shared by the admin editor, the publish action and the public page,
// so a bad value (a foreign host, a duplicate, a seventh image) is dropped the same
// way everywhere instead of breaking the page.

/** Cover included. */
export const MAX_PROJECT_IMAGES = 6

/** Uploads go to Vercel Blob only (see /api/upload); next/image only loads from there too. */
export function isBlobImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com')
  } catch {
    return false
  }
}

/** How many pictures the gallery may hold next to this cover. */
export function galleryCapacity(cover?: string): number {
  return MAX_PROJECT_IMAGES - (cover ? 1 : 0)
}

/** Keeps the Blob URLs only, once each, never the cover again, in order, up to the limit. */
export function cleanGallery(gallery: unknown, cover?: string): string[] {
  if (!Array.isArray(gallery)) return []
  const seen = new Set<string>(cover ? [cover] : [])
  const out: string[] = []
  for (const url of gallery) {
    if (!isBlobImageUrl(url) || seen.has(url)) continue
    seen.add(url)
    out.push(url)
    if (out.length >= galleryCapacity(cover)) break
  }
  return out
}

/** What the detail page shows, in order: the cover, then the gallery. */
export function projectImages(project: { image?: string; gallery?: string[] }): string[] {
  const cover = project.image || undefined
  return [...(cover ? [cover] : []), ...cleanGallery(project.gallery, cover)]
}

/** The phone view: up to six pictures of its own, no cover. */
export const MAX_MOBILE_IMAGES = 6

export function mobileImages(project: { galleryMobile?: string[] }): string[] {
  return cleanGallery(project.galleryMobile)
}

/**
 * How a picture sits in a frame of screen proportions. A screenshot (about 5:4 to 2.6:1) fills
 * the frame edge to edge, from its top, with no empty bands. Anything else (a phone screenshot,
 * a logo, a diagram, a very wide banner) stays whole instead of being cut; its empty bands are
 * filled by a blurred copy of itself (see ProjectPicture).
 */
export function pictureFit(width: number, height: number): 'cover' | 'contain' {
  if (!(width > 0) || !(height > 0)) return 'cover'
  const ratio = width / height
  return ratio >= 1.25 && ratio <= 2.6 ? 'cover' : 'contain'
}

/** Swaps two neighbours; out of range returns the list untouched. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Publishing: normalises the gallery of every project; the rest of the data is untouched. */
export function sanitizeProjectGalleries<T extends { image?: string; gallery?: string[]; galleryMobile?: string[] }>(projects: T[]): T[] {
  return projects.map((p) => {
    if (p.gallery === undefined && p.galleryMobile === undefined) return p
    const { gallery: _gallery, galleryMobile: _mobile, ...rest } = p
    const gallery = cleanGallery(p.gallery, p.image || undefined)
    const galleryMobile = cleanGallery(p.galleryMobile)
    return { ...rest, ...(gallery.length ? { gallery } : {}), ...(galleryMobile.length ? { galleryMobile } : {}) } as T
  })
}
