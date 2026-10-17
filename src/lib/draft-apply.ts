// Turning a reviewed draft into a change of the site — the ONE place where an
// assistant draft can reach site data, and only when the administrator clicks
// "Appliquer" (actions/assistant-apply.ts). The assistant's own code
// (src/lib/assistant, the chat route and its tools) cannot import this file; a
// test pins that. Everything here is plain logic over injected ports, so each
// rule — slug already taken, text changed since the draft was written, the site
// moved on while the admin was reading — is unit-tested without a database.
import type { BlogPost, PortfolioData } from '@/types'
import {
  PATCH_FIELDS, SLUG_RE, blogFieldsSchema, fingerprint, readPatchTarget, readTimeOf,
  type BlogFields, type BlogPayload, type DraftDTO, type PatchPayload, type PatchSection,
} from '@/lib/assistant/drafts'

export type PortfolioKey = PatchSection

// The public pages translate a post with exactly these field sets, in this
// order (the cache key hashes the French text): the article page / metadata /
// social card use the first, the blog list and the RSS feed the second.
// tests/draft-apply.test.ts checks the pages still use them.
export const BLOG_TRANSLATION_FIELD_SETS = [['title', 'excerpt', 'content'], ['title', 'excerpt']] as const

export interface ApplyOptions {
  /** Publish the article straight away. Default: it is added hidden, like a draft made in the blog editor. */
  publish: boolean
  /** Also store the reviewed English text, so visitors see exactly what was reviewed. */
  includeEnglish: boolean
  /** Required to publish an article that still lists claims to verify. */
  acknowledgeClaims: boolean
}

export type ApplyErrorCode = 'invalid' | 'exists' | 'not_found' | 'changed' | 'claims' | 'conflict' | 'no_portfolio' | 'already' | 'failed'

export interface TranslationSeed {
  key: string
  source: Record<string, string>
  translated: Record<string, string>
}

export interface ApplyPlan {
  key: PortfolioKey
  nextValue: unknown
  beforeJson: string
  afterJson: string
  summary: string
  published: boolean
  seeds: TranslationSeed[]
}

export type PlanResult = { ok: true; plan: ApplyPlan } | { ok: false; code: ApplyErrorCode; error: string }

const fail = (code: ApplyErrorCode, error: string): PlanResult => ({ ok: false, code, error })

const pick = (fields: BlogFields, names: readonly string[]): Record<string, string> =>
  Object.fromEntries(names.map((n) => [n, fields[n as keyof BlogFields]]))

function planBlog(draft: DraftDTO, data: PortfolioData, opts: ApplyOptions): PlanResult {
  const payload = draft.payload as BlogPayload
  const fr = blogFieldsSchema.safeParse(payload.fr)
  if (!fr.success || !SLUG_RE.test(payload.slug) || !payload.category?.trim()) return fail('invalid', "Ce brouillon ne respecte plus les contraintes du blog : régénère-le ou copie-le à la main.")
  if (data.blog.some((p) => p.slug === payload.slug)) return fail('exists', `Un article avec le slug « ${payload.slug} » existe déjà sur le site. Renomme ou supprime l'ancien, ou demande à l'assistant un brouillon avec un autre slug.`)
  if (opts.publish && draft.unverifiedClaims.length > 0 && !opts.acknowledgeClaims) return fail('claims', "Ce brouillon contient des affirmations à vérifier : confirme que tu les as vérifiées avant de le publier.")

  const post: BlogPost = {
    slug: payload.slug,
    title: fr.data.title,
    excerpt: fr.data.excerpt,
    date: payload.date,
    category: payload.category,
    readTime: payload.readTime || readTimeOf(fr.data.content),
    content: fr.data.content,
    published: opts.publish,
    externalUrl: '',
    author: '',
    coverImage: '',
  }
  const nextValue = [post, ...data.blog]

  const seeds: TranslationSeed[] = []
  if (opts.includeEnglish && payload.en) {
    const en = blogFieldsSchema.safeParse(payload.en)
    if (en.success) {
      for (const names of BLOG_TRANSLATION_FIELD_SETS) seeds.push({ key: `blog:${payload.slug}`, source: pick(fr.data, names), translated: pick(en.data, names) })
    }
  }

  return {
    ok: true,
    plan: {
      key: 'blog', nextValue,
      beforeJson: JSON.stringify(data.blog), afterJson: JSON.stringify(nextValue),
      summary: opts.publish ? `Article « ${post.title} » publié` : `Article « ${post.title} » ajouté au blog, masqué (à publier depuis l'éditeur du blog)`,
      published: opts.publish,
      seeds,
    },
  }
}

function replaceField<T extends object>(list: T[], match: (item: T) => boolean, field: string, value: string): T[] {
  return list.map((item) => (match(item) ? { ...item, [field]: value } : item))
}

function planPatch(draft: DraftDTO, data: PortfolioData): PlanResult {
  const payload = draft.payload as PatchPayload
  const { target } = payload
  if (!(PATCH_FIELDS[target.section] as readonly string[] | undefined)?.includes(target.field)) return fail('invalid', "Cible du brouillon non autorisée.")
  const current = readPatchTarget(data, target)
  if (current === null) return fail('not_found', "L'élément visé par ce brouillon n'existe plus sur le site.")
  if (!draft.baseHash || fingerprint(current) !== draft.baseHash) return fail('changed', "Le texte a changé sur le site depuis la rédaction de ce brouillon : demande à l'assistant d'en refaire un à partir du texte actuel.")
  if (!payload.after.trim()) return fail('invalid', 'La proposition est vide.')

  let nextValue: unknown
  switch (target.section) {
    case 'projects': nextValue = replaceField(data.projects, (p) => p.slug === target.id, target.field, payload.after); break
    case 'experiences': nextValue = replaceField(data.experiences, (e) => e.id === target.id, target.field, payload.after); break
    case 'offers': nextValue = replaceField(data.offers, (o) => o.id === target.id, target.field, payload.after); break
    case 'educations': nextValue = replaceField(data.educations, (e) => e.id === target.id, target.field, payload.after); break
    case 'blog': nextValue = replaceField(data.blog, (b) => b.slug === target.id, target.field, payload.after); break
    case 'vision': nextValue = { ...data.vision, [target.field]: payload.after }; break
    case 'personal': nextValue = { ...data.personal, [target.field]: payload.after }; break
  }
  return {
    ok: true,
    plan: {
      key: target.section, nextValue,
      beforeJson: JSON.stringify(data[target.section]), afterJson: JSON.stringify(nextValue),
      summary: `${target.section} · ${target.id} · ${target.field} mis à jour`,
      published: false,
      seeds: [],
    },
  }
}

export function planApply(draft: DraftDTO, data: PortfolioData, opts: ApplyOptions): PlanResult {
  if (draft.status !== 'draft') return fail('already', draft.status === 'applied' ? 'Ce brouillon est déjà appliqué.' : 'Ce brouillon a été écarté.')
  return draft.kind === 'blog_post' ? planBlog(draft, data, opts) : planPatch(draft, data)
}

// ── Orchestration over ports ────────────────────────────────────────────────────────────

export interface AppliedRecord { draftId: string; key: PortfolioKey; beforeJson: string; afterJson: string; summary: string; published: boolean; at: Date }

export interface ApplyPorts {
  read(): Promise<{ data: PortfolioData; version: string } | null>
  /** Replaces one top-level key only if the document is still at `version`. */
  replaceKey(key: PortfolioKey, value: unknown, expectedVersion: string): Promise<'ok' | 'conflict'>
  seedTranslation(seed: TranslationSeed): Promise<void>
  journal(record: AppliedRecord): Promise<void>
  markApplied(draftId: string, info: { at: Date; published: boolean; summary: string }): Promise<boolean>
  now(): Date
}

export type ApplyOutcome =
  | { ok: true; summary: string; published: boolean; warnings: string[] }
  | { ok: false; code: ApplyErrorCode; error: string }

export async function applyDraft(ports: ApplyPorts, draft: DraftDTO, opts: ApplyOptions): Promise<ApplyOutcome> {
  const snapshot = await ports.read()
  if (!snapshot) return { ok: false, code: 'no_portfolio', error: 'Le portfolio est illisible pour le moment.' }
  const planned = planApply(draft, snapshot.data, opts)
  if (!planned.ok) return planned
  const { plan } = planned

  const written = await ports.replaceKey(plan.key, plan.nextValue, snapshot.version)
  if (written === 'conflict') return { ok: false, code: 'conflict', error: "Le site a été modifié pendant que tu relisais ce brouillon. Rien n'a été écrit : réessaie." }

  // The site is changed from here on. What follows must not make it look like it failed.
  const warnings: string[] = []
  const at = ports.now()
  for (const seed of plan.seeds) {
    try { await ports.seedTranslation(seed) } catch { warnings.push("La version anglaise relue n'a pas pu être enregistrée : le site la traduira automatiquement.") ; break }
  }
  try {
    await ports.journal({ draftId: draft.id, key: plan.key, beforeJson: plan.beforeJson, afterJson: plan.afterJson, summary: plan.summary, published: plan.published, at })
  } catch {
    warnings.push("Le journal d'annulation n'a pas pu être écrit : l'annulation en un clic ne sera pas disponible (les sauvegardes restent possibles).")
  }
  try {
    if (!(await ports.markApplied(draft.id, { at, published: plan.published, summary: plan.summary }))) warnings.push("Le brouillon n'a pas pu être marqué comme appliqué.")
  } catch {
    warnings.push("Le brouillon n'a pas pu être marqué comme appliqué.")
  }
  return { ok: true, summary: plan.summary, published: plan.published, warnings }
}

// ── Undo ───────────────────────────────────────────────────────────────────────────────────

export interface UndoPorts {
  read(): Promise<{ data: PortfolioData; version: string } | null>
  replaceKey(key: PortfolioKey, value: unknown, expectedVersion: string): Promise<'ok' | 'conflict'>
  getApplied(draftId: string): Promise<(AppliedRecord & { undoneAt?: Date }) | null>
  markUndone(draftId: string): Promise<void>
  markUnapplied(draftId: string): Promise<void>
}

export type UndoOutcome = { ok: true; summary: string } | { ok: false; code: ApplyErrorCode; error: string }

/**
 * Puts the key back as it was before the application — only if nobody touched it
 * since. If the site moved on, nothing is written (the weekly backups remain).
 */
export async function undoDraft(ports: UndoPorts, draftId: string): Promise<UndoOutcome> {
  const applied = await ports.getApplied(draftId)
  if (!applied || applied.undoneAt) return { ok: false, code: 'not_found', error: "Aucune application à annuler pour ce brouillon." }
  const snapshot = await ports.read()
  if (!snapshot) return { ok: false, code: 'no_portfolio', error: 'Le portfolio est illisible pour le moment.' }
  if (JSON.stringify(snapshot.data[applied.key]) !== applied.afterJson) {
    return { ok: false, code: 'changed', error: "Cette partie du site a été modifiée depuis l'application : l'annulation automatique est refusée pour ne pas écraser ton travail. Corrige à la main ou restaure une sauvegarde." }
  }
  const written = await ports.replaceKey(applied.key, JSON.parse(applied.beforeJson), snapshot.version)
  if (written === 'conflict') return { ok: false, code: 'conflict', error: "Le site a été modifié pendant l'opération. Rien n'a été écrit : réessaie." }
  await ports.markUndone(draftId)
  await ports.markUnapplied(draftId)
  return { ok: true, summary: `Annulé : ${applied.summary}` }
}
