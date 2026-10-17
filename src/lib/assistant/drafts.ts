// Draft shapes and the pure rules around them (no database here). A draft is the
// ONLY thing the assistant ever produces: a proposal stored apart from the site
// data, that the admin reads, copies, or discards. Nothing here can publish.
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { PortfolioData } from '@/types'
import type { ReminderPayload } from '@/lib/assistant/reminders'

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// What the model is asked to return. Deliberately plain (lengths only, no
// regex): Gemini's structured-output schema is a subset of JSON Schema, and the
// strict checks are applied afterwards by finalizeBlogDraft().
export const blogModelSchema = z.object({
  title: z.string().min(5).max(160),
  slug: z.string().min(3).max(120),
  category: z.string().min(2).max(60),
  excerpt: z.string().min(30).max(500),
  content: z.string().min(300).max(40_000),
  unverifiedClaims: z.array(z.string().max(300)).max(15),
})
export type BlogModelOutput = z.infer<typeof blogModelSchema>

export const blogFieldsSchema = z.object({
  title: z.string().min(5).max(140),
  excerpt: z.string().min(30).max(320),
  content: z.string().min(300).max(40_000),
})
export type BlogFields = z.infer<typeof blogFieldsSchema>

export interface BlogPayload {
  slug: string
  category: string
  readTime: string
  date: string
  fr: BlogFields
  en: BlogFields | null
  /** Set when the English version could not be produced (quota, error). */
  enError?: string
}

// Fields the assistant may propose a rewrite for. An allowlist: the target is
// resolved against the real data, never trusted from the model.
export const PATCH_FIELDS = {
  projects: ['title', 'description', 'longDescription', 'caseStudyContext', 'caseStudySolution', 'caseStudyResults'],
  experiences: ['role', 'description'],
  offers: ['title', 'description'],
  blog: ['title', 'excerpt', 'content'],
  educations: ['detail'],
  vision: ['quote'],
  personal: ['bio', 'role'],
} as const
export type PatchSection = keyof typeof PATCH_FIELDS

export interface PatchTarget { section: PatchSection; id: string; field: string }

export interface PatchPayload {
  target: PatchTarget
  before: string
  after: string
  afterEn: string | null
  rationale: string
  enError?: string
}

export type DraftKind = 'blog_post' | 'field_patch' | 'email_reminder'
export type DraftPayload = BlogPayload | PatchPayload | ReminderPayload

/** Kinds that can be applied to the site. An e-mail draft cannot: the admin sends it from their own mail app. */
export const APPLICABLE_KINDS: readonly DraftKind[] = ['blog_post', 'field_patch']

export interface DraftDTO {
  id: string
  kind: DraftKind
  title: string
  status: 'draft' | 'discarded' | 'applied'
  version: number
  createdAt: string
  updatedAt: string
  conversationId: string | null
  unverifiedClaims: string[]
  /** Fingerprint of the site data the draft was written against (null: new content). */
  baseHash: string | null
  payload: DraftPayload
  /** The payload before the latest revision, for the before/after view. */
  previousPayload: DraftPayload | null
  versions: { n: number; at: string; note: string }[]
  /** Set once the administrator has applied the draft to the site. */
  applied: { at: string; published: boolean; summary: string } | null
}

export const MAX_VERSIONS = 10

// ── Slug, reading time, sanitizing ─────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export function uniqueSlug(wanted: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base = slugify(wanted) || 'article'
  if (!used.has(base)) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 76)}-${i}`
    if (!used.has(candidate)) return candidate
  }
  return `${base.slice(0, 70)}-${Date.now().toString(36)}`
}

export function readTimeOf(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 200))} min`
}

// The assistant's text ends up in a Markdown editor and, later, on a public
// page: no active HTML, no javascript: links, and no images at all (a model
// must not invent image URLs, and a remote image is a data-leak channel).
export function sanitizeMarkdown(md: string): string {
  return md
    .replace(/<\s*(script|iframe|object|embed|style|link|meta|form)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style|link|meta|form)\b[^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\]\(\s*(javascript|data|vbscript):[^)]*\)/gi, '](#)')
    .replace(/\r\n/g, '\n')
    .trim()
}

// The public blog renders a small subset of Markdown, line by line (headings, bold,
// a rule, images, videos, paragraphs). Anything else would show up as raw symbols:
// "- item" lines, "```" fences, "[text](url)", "*italics*"... The model is told so,
// and this turns what slips through into plain text the page displays properly.
export function toBlogMarkdown(md: string): string {
  const out: string[] = []
  let inFence = false
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; continue }
    if (inFence) { out.push(raw.trim() === '' ? '' : raw.replace(/^\s+/, '')); continue }
    let line = raw
      .replace(/^(#{4,})\s+/, '### ') // the page knows three heading levels
      .replace(/^\s*>\s?/, '') // quotes
      .replace(/^\s*[-*+]\s+/, '• ') // bullets
      .replace(/^\s*(\d+)[.)]\s+/, '$1. ') // numbered items
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)') // links
      .replace(/`([^`]+)`/g, '$1') // inline code
    line = line
      .replace(/(^|[^*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, '$1$2') // *italics* (keeps **bold**)
      .replace(/(^|[^\w])_(?!\s)([^_\n]+?)(?<!\s)_(?!\w)/g, '$1$2') // _italics_
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** The text of a rewrite, cleaned for where it will go (an article body also has to fit the blog's format). */
export function cleanPatchText(target: { section: string; field: string }, text: string): string {
  const safe = sanitizeMarkdown(text)
  return target.section === 'blog' && target.field === 'content' ? toBlogMarkdown(safe) : safe
}

const todayIso = (now: Date) => now.toISOString().slice(0, 10)

export interface FinalizeContext {
  existingSlugs: Iterable<string>
  categories: string[]
  now?: Date
}

/**
 * Turns the model's raw output into a draft the site could take as is: unique
 * slug, a category that matches the existing ones when it plausibly is one, a
 * reading time computed from the text (not claimed by the model), clean Markdown.
 * Throws a ZodError when the result does not meet the blog's constraints.
 */
export function finalizeBlogDraft(raw: BlogModelOutput, ctx: FinalizeContext): { payload: Omit<BlogPayload, 'en'>; unverifiedClaims: string[] } {
  const content = toBlogMarkdown(sanitizeMarkdown(raw.content))
  const fields = blogFieldsSchema.parse({ title: raw.title.trim(), excerpt: raw.excerpt.trim(), content })

  const wanted = raw.category.trim()
  const match = ctx.categories.find((c) => c.trim().toLowerCase() === wanted.toLowerCase())
  const slug = uniqueSlug(raw.slug || raw.title, ctx.existingSlugs)
  if (!SLUG_RE.test(slug)) throw new Error('Slug invalide après normalisation.')

  return {
    payload: {
      slug,
      category: match ?? wanted,
      readTime: readTimeOf(fields.content),
      date: todayIso(ctx.now ?? new Date()),
      fr: fields,
    },
    unverifiedClaims: raw.unverifiedClaims.map((c) => c.trim()).filter(Boolean),
  }
}

// ── Patches: resolve the target against the real data ──────────────────────────

export function readPatchTarget(data: PortfolioData, target: PatchTarget): string | null {
  const allowed = PATCH_FIELDS[target.section] as readonly string[] | undefined
  if (!allowed || !allowed.includes(target.field)) return null
  let record: unknown
  switch (target.section) {
    case 'projects': record = data.projects.find((p) => p.slug === target.id); break
    case 'experiences': record = data.experiences.find((e) => e.id === target.id); break
    case 'offers': record = data.offers.find((o) => o.id === target.id); break
    case 'blog': record = data.blog.find((b) => b.slug === target.id); break
    case 'educations': record = data.educations.find((e) => e.id === target.id); break
    case 'vision': record = data.vision; break
    case 'personal': record = data.personal; break
  }
  const value = record ? (record as Record<string, unknown>)[target.field] : undefined
  return typeof value === 'string' ? value : null
}

export const fingerprint = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 16)
