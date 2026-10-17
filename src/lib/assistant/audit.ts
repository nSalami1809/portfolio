// Deterministic quality audit of the portfolio. The numbers come from code, not
// from the model (which only interprets them): exact, free of quota, repeatable.
import type { PortfolioData } from '@/types'

export type Severity = 'high' | 'medium' | 'low'

export interface AuditIssue {
  area: 'projects' | 'blog' | 'skills' | 'experiences' | 'offers' | 'profile'
  severity: Severity
  item: string
  message: string
}

export interface SkillCoverageRow {
  category: string
  skill: string
  projects: number
  experiences: number
  articles: number
  total: number
}

export interface PortfolioAudit {
  counts: { projects: number; blogPublished: number; blogDrafts: number; skills: number; experiences: number; offers: number; testimonials: number }
  issues: AuditIssue[]
  issuesTotal: number
  skillCoverage: SkillCoverageRow[]
  /** Listed skills mentioned nowhere, or only once, in the portfolio's own content. */
  underrepresentedSkills: { skill: string; category: string; mentions: number }[]
  /** Technologies used in projects/experiences that no skill lists. */
  technologiesNotListed: { tag: string; usedIn: number }[]
}

const MAX_ISSUES = 60
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

export const normalize = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function mentions(haystackNorm: string, skill: string): boolean {
  const needle = normalize(skill)
  if (!needle) return false
  return new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(needle)}($|[^a-z0-9+#])`).test(haystackNorm)
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export function auditPortfolio(data: PortfolioData, views: Record<string, number> = {}, now: Date = new Date()): PortfolioAudit {
  const issues: AuditIssue[] = []
  const add = (area: AuditIssue['area'], severity: Severity, item: string, message: string) => issues.push({ area, severity, item, message })

  // ── Projects ──────────────────────────────────────────────────────────────
  for (const p of data.projects) {
    const item = p.title || p.slug
    if (!p.image) add('projects', 'medium', item, "Pas d'image : la carte du projet n'a aucun visuel.")
    if (!p.description || p.description.trim().length < 60) add('projects', 'medium', item, 'Description courte (moins de 60 caractères).')
    if (!p.longDescription || p.longDescription.trim().length < 200) add('projects', 'low', item, 'Description détaillée absente ou très courte.')
    if (!p.tags?.length) add('projects', 'medium', item, 'Aucune technologie indiquée.')
    if (p.status === 'completed' && !(p.caseStudyContext || p.caseStudySolution || p.caseStudyResults)) {
      add('projects', 'high', item, "Projet terminé sans étude de cas (contexte, solution, résultats) : c'est ce qui convainc un visiteur.")
    }
    if (p.status === 'completed' && !p.liveUrl && !p.githubUrl) add('projects', 'low', item, 'Projet terminé sans lien de démo ni de code.')
  }

  // ── Blog ──────────────────────────────────────────────────────────────────
  const slugs = new Map<string, number>()
  for (const p of data.blog) slugs.set(p.slug, (slugs.get(p.slug) ?? 0) + 1)
  for (const p of data.blog) {
    const item = p.title || p.slug
    if ((slugs.get(p.slug) ?? 0) > 1) add('blog', 'high', item, `Le slug « ${p.slug} » est utilisé par plusieurs articles.`)
    if (!p.excerpt || p.excerpt.trim().length < 40) add('blog', 'medium', item, 'Extrait absent ou trop court (utilisé pour les aperçus et le SEO).')
    else if (p.excerpt.trim().length > 300) add('blog', 'low', item, 'Extrait de plus de 300 caractères : il sera coupé dans les aperçus.')
    if (p.published && !p.externalUrl && p.content.trim().length < 800) add('blog', 'medium', item, 'Article publié très court (moins de 800 caractères).')
    if (p.published && !p.coverImage) add('blog', 'low', item, "Article publié sans image de couverture.")
    if (!p.externalUrl) {
      const estimate = Math.max(1, Math.ceil(words(p.content) / 200))
      const declared = Number.parseInt(p.readTime, 10)
      if (Number.isFinite(declared) && Math.abs(declared - estimate) >= 3) add('blog', 'low', item, `Temps de lecture déclaré ${declared} min, estimé ~${estimate} min.`)
    }
    const age = (now.getTime() - new Date(p.date).getTime()) / 86_400_000
    if (!p.published && age > 90) add('blog', 'low', item, `Brouillon vieux de ${Math.round(age)} jours, jamais publié.`)
    if (p.published && age > 30 && (views[p.slug] ?? 0) === 0) add('blog', 'medium', item, 'Publié depuis plus de 30 jours et aucune vue enregistrée.')
  }

  // ── Experiences ───────────────────────────────────────────────────────────
  for (const e of data.experiences) {
    const item = `${e.role} — ${e.company}`
    if (!e.description || e.description.trim().length < 80) add('experiences', 'medium', item, 'Description courte : détaillez missions et résultats.')
    if (!e.tags?.length) add('experiences', 'low', item, 'Aucune technologie indiquée.')
  }

  // ── Offers ────────────────────────────────────────────────────────────────
  for (const o of data.offers) {
    if (typeof o.priceHTMin !== 'number' || typeof o.priceHTMax !== 'number') add('offers', 'medium', o.title, 'Pas de fourchette de prix : cette offre ne peut pas alimenter le devis instantané.')
    if (!o.features?.length) add('offers', 'low', o.title, 'Aucun élément « inclus » listé.')
    if (!o.description || o.description.trim().length < 40) add('offers', 'low', o.title, 'Description très courte.')
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  if (!data.personal.bio || data.personal.bio.trim().length < 150) add('profile', 'medium', 'Bio', 'Bio courte (moins de 150 caractères).')
  if (!data.personal.cvUrl) add('profile', 'medium', 'CV', 'Aucun CV téléchargeable.')
  for (const [name, url] of Object.entries(data.socials)) if (!url) add('profile', 'low', `Réseau : ${name}`, 'Lien non renseigné.')

  // ── Skills vs. the portfolio's own content ────────────────────────────────
  const projectTexts = data.projects.map((p) => normalize([p.title, p.description, p.longDescription, p.category, ...(p.tags ?? []), p.caseStudyContext, p.caseStudySolution, p.caseStudyResults].join(' \n ')))
  const experienceTexts = data.experiences.map((e) => normalize([e.role, e.company, e.description, ...(e.tags ?? [])].join(' \n ')))
  const articleTexts = data.blog.map((b) => normalize([b.title, b.excerpt, b.category, b.content].join(' \n ')))

  const skillCoverage: SkillCoverageRow[] = []
  for (const group of data.skills) {
    if (group.items.length < 2) add('skills', 'low', group.category, 'Catégorie de compétences avec un seul élément.')
    for (const skill of group.items) {
      const projects = projectTexts.filter((t) => mentions(t, skill)).length
      const experiences = experienceTexts.filter((t) => mentions(t, skill)).length
      const articles = articleTexts.filter((t) => mentions(t, skill)).length
      skillCoverage.push({ category: group.category, skill, projects, experiences, articles, total: projects + experiences + articles })
    }
  }
  const underrepresentedSkills = skillCoverage
    .filter((r) => r.total <= 1)
    .sort((a, b) => a.total - b.total)
    .map((r) => ({ skill: r.skill, category: r.category, mentions: r.total }))
  for (const r of underrepresentedSkills.slice(0, 15)) {
    add('skills', r.mentions === 0 ? 'high' : 'medium', r.skill, r.mentions === 0 ? 'Compétence listée mais mentionnée dans aucun projet, expérience ni article.' : "Compétence mentionnée une seule fois dans tout le portfolio.")
  }

  // Technologies used in projects/experiences that no skill lists.
  const listed = data.skills.flatMap((g) => g.items.map(normalize))
  const used = new Map<string, { label: string; n: number }>()
  for (const tag of [...data.projects.flatMap((p) => p.tags ?? []), ...data.experiences.flatMap((e) => e.tags ?? [])]) {
    const key = normalize(tag)
    if (!key) continue
    const entry = used.get(key) ?? { label: tag, n: 0 }
    entry.n++
    used.set(key, entry)
  }
  const technologiesNotListed = [...used.entries()]
    .filter(([key]) => !listed.some((s) => s === key || mentions(s, key) || mentions(key, s)))
    .map(([, v]) => ({ tag: v.label, usedIn: v.n }))
    .sort((a, b) => b.usedIn - a.usedIn)
    .slice(0, 20)
  for (const t of technologiesNotListed.slice(0, 8)) add('skills', 'low', t.tag, `Technologie utilisée dans ${t.usedIn} élément(s) mais absente de la liste de compétences.`)

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  return {
    counts: {
      projects: data.projects.length,
      blogPublished: data.blog.filter((b) => b.published).length,
      blogDrafts: data.blog.filter((b) => !b.published).length,
      skills: data.skills.reduce((n, g) => n + g.items.length, 0),
      experiences: data.experiences.length,
      offers: data.offers.length,
      testimonials: data.testimonials.length,
    },
    issues: issues.slice(0, MAX_ISSUES),
    issuesTotal: issues.length,
    skillCoverage: skillCoverage.sort((a, b) => a.total - b.total).slice(0, 80),
    underrepresentedSkills: underrepresentedSkills.slice(0, 25),
    technologiesNotListed,
  }
}
