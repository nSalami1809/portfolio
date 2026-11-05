import type { Testimonial } from '@/types'

/** A testimonial as the public card needs it: the texts that depend on the language are already made on the server. */
export type PublicTestimonial = Testimonial & {
  /** "Delivered project: TSWE" — only when the testimonial is linked to one of the projects */
  verifiedText?: string
  /** Accessible name of the LinkedIn link ("LinkedIn profile of …") */
  linkedinLabel?: string
}

/**
 * The testimonials that talk about a delivered job come first: those linked to one of the projects (the admin's "linked
 * project" field). The others keep their order after them.
 */
export function deliveredFirst<T extends { projectSlug?: string }>(list: T[]): T[] {
  return [...list.filter((t) => t.projectSlug), ...list.filter((t) => !t.projectSlug)]
}

/** A LinkedIn address worth linking to: https, on linkedin.com. Anything else (another site, a script, a typo) is dropped. */
export function safeLinkedinUrl(url?: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    const host = u.hostname.toLowerCase()
    if (u.protocol !== 'https:') return null
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null
    return u.toString()
  } catch {
    return null
  }
}
