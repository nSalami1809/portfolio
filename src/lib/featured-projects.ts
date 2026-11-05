import type { Project } from '@/types'

type Candidate = Pick<Project, 'slug' | 'status' | 'image' | 'caseStudyContext' | 'caseStudyResults'>

/**
 * The projects put forward on the home page, chosen by their slug (the last part of the project's address), in this order.
 * To change the choice, change this list. A slug that does not exist (a project renamed or removed) is skipped, and the
 * gap is filled with the best-explained other projects, so the section never shows fewer than it could.
 */
export const FEATURED_PROJECT_SLUGS = ['tswe', 'fpbg', 'yam-na']

/**
 * The projects the home page puts forward: taken from the same list as /projects, nothing copied. The chosen ones first
 * (whatever their status: it is a deliberate choice), then, to fill up, the ones that explain themselves best: delivered,
 * with a picture, with a case study, with a result. Ties keep the order of the list. A concept is never added by itself.
 */
export function pickFeaturedProjects<T extends Candidate>(projects: T[], max = 3, preferred: string[] = FEATURED_PROJECT_SLUGS): T[] {
  const chosen = preferred
    .map((slug) => projects.find((p) => p.slug === slug))
    .filter((p): p is T => Boolean(p))
    .slice(0, max)

  const score = (p: Candidate) =>
    (p.status === 'completed' ? 4 : 0) + (p.image ? 2 : 0) + (p.caseStudyContext?.trim() ? 2 : 0) + (p.caseStudyResults?.trim() ? 1 : 0)
  const filler = projects
    .map((p, i) => ({ p, i, s: score(p) }))
    .filter(({ p }) => p.status !== 'concept' && !chosen.includes(p))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ p }) => p)

  return [...chosen, ...filler].slice(0, max)
}
