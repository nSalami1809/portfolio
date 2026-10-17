// The model calls that produce draft text. Each one is bounded (output tokens,
// no automatic retries, abort signal) and counted against the daily cap by the
// UsageMeter, because on the free tier every request is quota.
import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import { translateEntries } from '@/lib/translate'
import { BudgetExceededError, type UsageMeter } from '@/lib/assistant/meter'
import { BLOG_WRITER_SYSTEM, LENGTH_WORDS, PATCH_SYSTEM, REVISER_SYSTEM } from '@/lib/assistant/prompts'
import { blogFieldsSchema, blogModelSchema, type BlogFields, type BlogModelOutput } from '@/lib/assistant/drafts'

export interface GenerationEnv {
  model: LanguageModel
  providerOptions: Record<string, Record<string, unknown>>
  maxDraftTokens: number
  meter: UsageMeter
  abortSignal?: AbortSignal
}

// Providers options are typed as JSON; ours are plain objects of primitives.
export const options = (env: GenerationEnv) => env.providerOptions as never

export function charge(env: GenerationEnv): void {
  if (!env.meter.canSpend(1)) throw new BudgetExceededError()
  env.meter.spend(1)
}

export interface BlogRequest {
  brief: string
  facts?: string
  tone?: string
  length: 'court' | 'moyen' | 'long'
  titleHint?: string
  categories: string[]
  /** Compact, already-filtered portfolio context the article may draw on. */
  sources: string
}

export async function writeBlogArticle(env: GenerationEnv, req: BlogRequest): Promise<BlogModelOutput> {
  charge(env)
  const { object } = await generateObject({
    model: env.model,
    schema: blogModelSchema,
    system: BLOG_WRITER_SYSTEM,
    prompt: [
      `SUJET / BRIEF :\n${req.brief}`,
      req.titleHint ? `TITRE SOUHAITÉ :\n${req.titleHint}` : '',
      req.tone ? `TON SOUHAITÉ :\n${req.tone}` : '',
      `LONGUEUR : ${LENGTH_WORDS[req.length]}.`,
      `CATÉGORIES EXISTANTES : ${req.categories.length ? req.categories.join(', ') : '(aucune)'}`,
      `FAITS FOURNIS PAR L'ADMINISTRATEUR :\n${req.facts?.trim() || '(aucun)'}`,
      `SOURCES (extraits du portfolio) :\n${req.sources}`,
    ].filter(Boolean).join('\n\n'),
    maxOutputTokens: env.maxDraftTokens,
    maxRetries: 0,
    providerOptions: options(env),
    ...(env.abortSignal ? { abortSignal: env.abortSignal } : {}),
  })
  return object
}

const reviseSchema = blogFieldsSchema

export async function reviseBlogFields(env: GenerationEnv, current: BlogFields, instruction: string): Promise<BlogFields> {
  charge(env)
  const { object } = await generateObject({
    model: env.model,
    schema: reviseSchema,
    system: REVISER_SYSTEM,
    prompt: `CONSIGNE DE L'ADMINISTRATEUR :\n${instruction}\n\nTEXTE ACTUEL (JSON) :\n${JSON.stringify(current)}`,
    maxOutputTokens: env.maxDraftTokens,
    maxRetries: 0,
    providerOptions: options(env),
    ...(env.abortSignal ? { abortSignal: env.abortSignal } : {}),
  })
  return object
}

export async function rewriteField(env: GenerationEnv, input: { label: string; before: string; instruction: string }): Promise<{ after: string; rationale: string }> {
  charge(env)
  const { object } = await generateObject({
    model: env.model,
    schema: z.object({ after: z.string().min(1).max(12_000), rationale: z.string().max(600) }),
    system: PATCH_SYSTEM,
    prompt: `CHAMP : ${input.label}\n\nCONSIGNE :\n${input.instruction}\n\nTEXTE ACTUEL :\n${input.before}`,
    maxOutputTokens: Math.min(env.maxDraftTokens, 4000),
    maxRetries: 0,
    providerOptions: options(env),
    ...(env.abortSignal ? { abortSignal: env.abortSignal } : {}),
  })
  return object
}

/** French → English with the same prompt the public site uses (lib/translate.ts), on the assistant's model. */
export async function translateFields(env: GenerationEnv, fields: Record<string, string>): Promise<Record<string, string>> {
  charge(env)
  const entries = Object.entries(fields).filter(([, v]) => v.trim()) as [string, string][]
  return translateEntries(entries, {
    model: env.model,
    maxRetries: 0,
    providerOptions: env.providerOptions as never,
    ...(env.abortSignal ? { abortSignal: env.abortSignal } : {}),
  })
}
