// What a visitor can do at the end of a project page: go to the previous or the next project of
// the list, or see the projects that look like this one. Pure functions, no data fetching.

export interface ProjectLink {
  slug: string
  title: string
  category: string
  tags: string[]
  image?: string
}

export interface MoreProjects {
  previous: ProjectLink | null
  next: ProjectLink | null
  related: ProjectLink[]
}

const norm = (s: string) => s.trim().toLowerCase()

/** The project before and the one after, in the order of the list, looping at both ends. */
export function neighbours(projects: ProjectLink[], slug: string): { previous: ProjectLink | null; next: ProjectLink | null } {
  const i = projects.findIndex((p) => p.slug === slug)
  if (i < 0 || projects.length < 2) return { previous: null, next: null }
  const next = projects[(i + 1) % projects.length]
  const previous = projects[(i - 1 + projects.length) % projects.length]
  // with two projects both neighbours are the same one: show it once, as "next"
  return { previous: previous.slug === next.slug ? null : previous, next }
}

/**
 * Up to `max` other projects that look like this one: the most technologies in common first
 * (a shared technology counts twice as much as the same category), then the order of the list.
 * A project with nothing in common is never offered.
 */
export function relatedProjects(current: ProjectLink, projects: ProjectLink[], max = 3): ProjectLink[] {
  const tags = new Set(current.tags.map(norm))
  return projects
    .filter((p) => p.slug !== current.slug)
    .map((p, order) => {
      const shared = new Set(p.tags.map(norm).filter((t) => tags.has(t))).size
      const sameCategory = norm(p.category) === norm(current.category) ? 1 : 0
      return { p, order, score: shared * 2 + sameCategory }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, max)
    .map((x) => x.p)
}

export function moreProjects(current: ProjectLink, projects: ProjectLink[]): MoreProjects {
  return { ...neighbours(projects, current.slug), related: relatedProjects(current, projects) }
}
