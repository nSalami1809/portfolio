// What the assistant is allowed to SEE of the portfolio. Each view is an
// explicit allowlist of fields (never a spread of the stored object), so a field
// added to the data model later — or a sensitive one that already exists, like
// personal.business.paymentDetails or personal.signatureUrl — does not reach the
// model, and from there Google, unless someone adds it here on purpose.
import type { BlogPost, Education, Experience, Offer, PersonalInfo, Project, SocialLinks } from '@/types'
import type { BusinessStats } from '@/lib/business-stats'

export const clip = (value: string | undefined | null, max: number): string => {
  const s = (value ?? '').trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

export function profileView(personal: PersonalInfo, socials: SocialLinks) {
  return {
    name: personal.name,
    role: personal.role,
    bio: clip(personal.bio, 1200),
    location: personal.location,
    hasCv: Boolean(personal.cvUrl),
    hasWhatsapp: Boolean(personal.whatsapp),
    socials: Object.fromEntries(Object.entries(socials).filter(([, url]) => url)),
  }
}

export function projectSummary(p: Project) {
  return {
    slug: p.slug,
    title: p.title,
    category: p.category,
    year: p.year,
    status: p.status,
    tags: p.tags,
    hasImage: Boolean(p.image),
    hasLiveUrl: Boolean(p.liveUrl),
    hasGithubUrl: Boolean(p.githubUrl),
    hasCaseStudy: Boolean(p.caseStudyContext || p.caseStudySolution || p.caseStudyResults),
  }
}

export function projectDetail(p: Project) {
  return {
    ...projectSummary(p),
    description: clip(p.description, 600),
    longDescription: clip(p.longDescription, 3000),
    liveUrl: p.liveUrl,
    githubUrl: p.githubUrl,
    caseStudyContext: clip(p.caseStudyContext, 2000),
    caseStudySolution: clip(p.caseStudySolution, 2000),
    caseStudyResults: clip(p.caseStudyResults, 2000),
  }
}

export function blogSummary(p: BlogPost, views: Record<string, number> = {}) {
  return {
    slug: p.slug,
    title: p.title,
    category: p.category,
    date: p.date,
    published: p.published,
    readTime: p.readTime,
    excerpt: clip(p.excerpt, 240),
    contentChars: p.content.length,
    hasCover: Boolean(p.coverImage),
    external: Boolean(p.externalUrl),
    views: views[p.slug] ?? 0,
  }
}

export function blogDetail(p: BlogPost, views: Record<string, number> = {}, maxContent = 8000) {
  return {
    ...blogSummary(p, views),
    excerpt: p.excerpt,
    content: clip(p.content, maxContent),
    contentTruncated: p.content.length > maxContent,
  }
}

export function experienceView(e: Experience) {
  return { id: e.id, period: e.period, role: e.role, company: e.company, description: clip(e.description, 700), tags: e.tags }
}

export function educationView(e: Education) {
  return { id: e.id, year: e.year, degree: e.degree, school: e.school, detail: clip(e.detail, 300) }
}

export function offerView(o: Offer) {
  return {
    id: o.id,
    title: o.title,
    priceLabel: o.priceLabel,
    priceHTMin: o.priceHTMin,
    priceHTMax: o.priceHTMax,
    featured: Boolean(o.featured),
    description: clip(o.description, 500),
    features: o.features ?? [],
  }
}

// Aggregates only: no client names, no addresses, no payment coordinates.
export function businessOverview(stats: BusinessStats) {
  const todoByKind: Record<string, number> = {}
  for (const t of stats.todo) todoByKind[t.kind] = (todoByKind[t.kind] ?? 0) + 1
  return {
    pipeline: stats.pipeline,
    conversionRate: stats.conversionRate,
    avgDaysToSign: stats.avgDaysToSign,
    cash: stats.cash,
    months: stats.months,
    inProgress: { count: stats.inProgress.length, late: stats.inProgress.filter((r) => r.late).length },
    awaitingRecette: { count: stats.awaitingRecette.length, late: stats.awaitingRecette.filter((r) => r.late).length },
    todoByKind,
  }
}

/**
 * Keeps a tool result under the size the model is allowed to receive. Arrays
 * lose trailing items (and say so); anything else is cut as text.
 */
export function capResult<T>(value: T, maxChars: number): T | { truncated: true; total?: number; items?: unknown; preview?: string } {
  const text = JSON.stringify(value)
  if (text.length <= maxChars) return value
  if (Array.isArray(value)) {
    let items = value.slice()
    while (items.length > 1 && JSON.stringify(items).length > maxChars - 120) items = items.slice(0, Math.max(1, Math.floor(items.length * 0.7)))
    return { truncated: true, total: value.length, items }
  }
  return { truncated: true, preview: text.slice(0, maxChars - 60) }
}
