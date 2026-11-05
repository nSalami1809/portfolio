import type { Project } from '@/types'

type Candidate = Pick<Project, 'status' | 'image' | 'caseStudyContext' | 'caseStudyResults'>

/**
 * The projects the home page puts forward: taken from the same list as /projects, nothing copied. The ones that
 * explain themselves best come first: delivered, with a picture, with a case study, with a result. Ties keep the
 * order of the list (so reordering the list in the admin changes the choice). A concept is not shown: it is not a delivery.
 */
export function pickFeaturedProjects<T extends Candidate>(projects: T[], max = 3): T[] {
  const score = (p: Candidate) =>
    (p.status === 'completed' ? 4 : 0) + (p.image ? 2 : 0) + (p.caseStudyContext?.trim() ? 2 : 0) + (p.caseStudyResults?.trim() ? 1 : 0)
  return projects
    .map((p, i) => ({ p, i, s: score(p) }))
    .filter(({ p }) => p.status !== 'concept')
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, max)
    .map(({ p }) => p)
}
