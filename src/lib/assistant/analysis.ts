// Analyses of CONTENT THE ASSISTANT DID NOT WRITE and cannot trust: published
// documents and visitors' chatbot conversations. Each one is a single, separate
// model call with NO tools and a strict output schema. That is the whole defence
// against prompt injection here: whatever a document or a visitor writes, the
// call it lands in cannot read the portfolio, write a draft, or reach anything
// else — the only thing that comes out is a short structured summary, which the
// main agent receives as data, marked untrusted.
import { generateObject } from 'ai'
import { z } from 'zod'
import { options, type GenerationEnv } from '@/lib/assistant/draft-generation'
import { CHATLOG_ANALYST_SYSTEM, DOC_ANALYST_SYSTEM } from '@/lib/assistant/prompts'
import { redactPersonalData } from '@/lib/assistant/redact'
import { sanitizeMarkdown } from '@/lib/assistant/drafts'
import type { ChatLogMessage } from '@/lib/chat-log'

const line = (max: number) => z.string().max(max)

const documentSchema = z.object({
  summary: line(2500),
  keyPoints: z.array(line(300)).max(12),
  answer: line(2000).optional(),
})
export type DocumentAnalysis = z.infer<typeof documentSchema>

const clean = (s: string) => sanitizeMarkdown(s).replace(/https?:\/\/\S+/g, '[lien]')

export interface DocumentInput {
  title: string
  task: 'summary' | 'extract' | 'question'
  question?: string
  /** A PDF, passed to the model as a file… */
  pdf?: Uint8Array
  /** …or the text of a Word file. */
  text?: string
}

export async function analyzeDocument(env: GenerationEnv, input: DocumentInput): Promise<DocumentAnalysis> {
  const ask = [
    `DOCUMENT : « ${input.title} »`,
    input.task === 'question' && input.question ? `QUESTION DE L'ADMINISTRATEUR : ${input.question}` : '',
    input.task === 'extract' ? "TÂCHE : extrais les informations factuelles clés (chiffres, dates, noms, engagements)." : '',
    input.task === 'summary' ? 'TÂCHE : résume le document.' : '',
  ].filter(Boolean).join('\n')

  const content = input.pdf
    ? [{ type: 'text' as const, text: ask }, { type: 'file' as const, data: input.pdf, mediaType: 'application/pdf' }]
    : [{ type: 'text' as const, text: `${ask}\n\nTEXTE DU DOCUMENT :\n${input.text ?? ''}` }]

  const { object } = await generateObject({
    model: env.model,
    schema: documentSchema,
    system: DOC_ANALYST_SYSTEM,
    messages: [{ role: 'user', content }],
    maxOutputTokens: 1800,
    maxRetries: 0,
    providerOptions: options(env),
    ...(env.abortSignal ? { abortSignal: env.abortSignal } : {}),
  })
  return {
    summary: clean(object.summary),
    keyPoints: object.keyPoints.map(clean),
    ...(object.answer ? { answer: clean(object.answer) } : {}),
  }
}

// ── Visitors' conversations ───────────────────────────────────────────────────────────────

const chatSchema = z.object({
  sampleSize: z.number().int().min(0).max(200),
  themes: z.array(z.object({ theme: line(80), conversations: z.number().int().min(0).max(200), example: line(240) })).max(8),
  unanswered: z.array(z.object({ question: line(240), why: line(240) })).max(6),
  interestSignals: z.array(line(240)).max(6),
  suggestions: z.array(line(300)).max(8),
})
export type ChatAnalysis = z.infer<typeof chatSchema>

export const MAX_CONVERSATIONS = 40
const MAX_MESSAGES_PER_CONVERSATION = 12
const MAX_CHARS_PER_MESSAGE = 400
export const MAX_TRANSCRIPT_CHARS = 14_000

/** Anonymized, size-bounded text of the conversations. Nothing reaches the model that did not pass through here. */
export function buildTranscript(conversations: ChatLogMessage[][]): { text: string; used: number } {
  const blocks: string[] = []
  let used = 0
  let size = 0
  for (const messages of conversations.slice(0, MAX_CONVERSATIONS)) {
    const lines = messages
      .slice(0, MAX_MESSAGES_PER_CONVERSATION)
      .map((m) => `${m.role === 'user' ? 'Visiteur' : 'Chatbot'} : ${redactPersonalData(m.text).replace(/\s+/g, ' ').slice(0, MAX_CHARS_PER_MESSAGE)}`)
    if (lines.length === 0) continue
    const block = `--- conversation ${used + 1} ---\n${lines.join('\n')}`
    if (size + block.length > MAX_TRANSCRIPT_CHARS) break
    blocks.push(block)
    size += block.length
    used++
  }
  return { text: blocks.join('\n\n'), used }
}

export async function analyzeChatLogs(env: GenerationEnv, conversations: ChatLogMessage[][], focus?: string): Promise<ChatAnalysis | { empty: true }> {
  const { text, used } = buildTranscript(conversations)
  if (used === 0) return { empty: true }
  const { object } = await generateObject({
    model: env.model,
    schema: chatSchema,
    system: CHATLOG_ANALYST_SYSTEM,
    prompt: `${focus ? `POINT D'ATTENTION DE L'ADMINISTRATEUR : ${focus}\n\n` : ''}${used} conversation(s) anonymisée(s) :\n\n${text}`,
    maxOutputTokens: 1800,
    maxRetries: 0,
    providerOptions: options(env),
    ...(env.abortSignal ? { abortSignal: env.abortSignal } : {}),
  })
  return {
    sampleSize: used,
    themes: object.themes.map((t) => ({ ...t, theme: clean(t.theme), example: clean(t.example) })),
    unanswered: object.unanswered.map((u) => ({ question: clean(u.question), why: clean(u.why) })),
    interestSignals: object.interestSignals.map(clean),
    suggestions: object.suggestions.map(clean),
  }
}
