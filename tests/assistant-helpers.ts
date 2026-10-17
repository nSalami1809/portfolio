// Shared fakes for the assistant tests: a scripted model, an in-memory drafts store
// and a complete set of injected dependencies. Not a test file.
import { vi } from 'vitest'
import { APICallError, type LanguageModel } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import type { AssistantDeps } from '@/lib/assistant/tools'
import { DEFAULT_LIMITS } from '@/lib/assistant/config'
import { UsageMeter } from '@/lib/assistant/meter'
import { classifyModelError } from '@/lib/assistant/quota'
import type { DraftDTO } from '@/lib/assistant/drafts'
import { makePortfolio } from './assistant-data'

// ── Fakes ──────────────────────────────────────────────────────────────────────────────

export const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
}

type Reply = unknown | Error

export function mockModel(replies: Reply[]) {
  const doGenerate = vi.fn(async () => {
    const next = replies.shift()
    if (next instanceof Error) throw next
    return { content: [{ type: 'text' as const, text: JSON.stringify(next) }], finishReason: { unified: 'stop' as const, raw: undefined }, usage, warnings: [] }
  })
  return { model: new MockLanguageModelV4({ doGenerate }) as unknown as LanguageModel, doGenerate }
}

export function fakeDraftStore() {
  const store = new Map<string, DraftDTO>()
  let n = 0
  return {
    store,
    create: vi.fn(async (input: Parameters<AssistantDeps['drafts']['create']>[0]) => {
      const id = `d${++n}`
      const now = new Date().toISOString()
      const d: DraftDTO = { id, kind: input.kind, title: input.title, status: 'draft', version: 1, createdAt: now, updatedAt: now, conversationId: input.conversationId ?? null, unverifiedClaims: input.unverifiedClaims ?? [], baseHash: input.baseHash ?? null, payload: input.payload, previousPayload: null, versions: [{ n: 1, at: now, note: 'Création' }], applied: null }
      store.set(id, d)
      return d
    }),
    get: vi.fn(async (id: string) => store.get(id) ?? null),
    list: vi.fn(async () => [...store.values()]),
    revise: vi.fn(async (id: string, expected: number, patch: Parameters<AssistantDeps['drafts']['revise']>[2]) => {
      const d = store.get(id)
      if (!d) return { ok: false as const, reason: 'not_found' as const }
      if (d.version !== expected) return { ok: false as const, reason: 'conflict' as const }
      const next: DraftDTO = { ...d, version: d.version + 1, payload: patch.payload, previousPayload: d.payload, title: patch.title ?? d.title }
      store.set(id, next)
      return { ok: true as const, draft: next }
    }),
  }
}

export function fakeDeps(over: Partial<AssistantDeps> & { replies?: Reply[]; used?: number } = {}) {
  const portfolio = makePortfolio()
  const drafts = fakeDraftStore()
  const { model, doGenerate } = mockModel(over.replies ?? [])
  const handleModelError = vi.fn(async (err: unknown) => classifyModelError(err))
  const deps: AssistantDeps = {
    getPortfolio: vi.fn(async () => portfolio),
    getBlogViews: vi.fn(async () => ({ premier: 120 })),
    getBusinessStats: vi.fn(async () => null),
    getOverview: vi.fn(async () => ({ contacts30d: 1, quotes30d: 2, bookings30d: 3, views30d: 400, views24h: 10, contactsPrev30d: 0, quotesPrev30d: 0, bookingsPrev30d: 0, viewsPrev30d: 300, upcomingBookings: 1, acceptedQuotes: 1, quoteAcceptanceRate: 0.5 })),
    fetchDocument: vi.fn(async () => ({ ok: true as const, bytes: new Uint8Array([37, 80, 68, 70]) })),
    getChatTranscripts: vi.fn(async () => []),
    drafts,
    model,
    providerOptions: {},
    limits: DEFAULT_LIMITS,
    meter: new UsageMeter(over.used ?? 0, DEFAULT_LIMITS.dailyRequests),
    conversationId: 'conv-1',
    handleModelError,
    now: () => new Date('2026-10-17T10:00:00Z'),
    ...over,
  }
  return { deps, portfolio, drafts, doGenerate, handleModelError }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const run = async (tool: any, input: unknown = {}) => tool.execute(input, { toolCallId: 't', messages: [] })

export const article = {
  title: 'Ce que mon passage chez SING SA m’a appris',
  slug: 'sing-sa-ce-que-jai-appris',
  category: 'Dev',
  excerpt: 'Retour sur mes missions de développement chez SING SA et ce que j’en retiens pour la suite.',
  content: '## Contexte\n\n' + 'Une phrase de test suffisamment longue pour le contenu. '.repeat(20),
  unverifiedClaims: ['Durée exacte de la mission'],
}
export const english = { title: 'What SING SA taught me', excerpt: 'A look back at my development work at SING SA and what I take from it for the future.', content: '## Context\n\n' + 'A test sentence that is long enough for the content. '.repeat(20) }

export function apiError(statusCode: number, message: string, responseBody = '') {
  return new APICallError({ message, url: 'https://example.test', requestBodyValues: {}, statusCode, responseBody })
}

