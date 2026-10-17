import { NextRequest } from 'next/server'
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { requireAdmin } from '@/lib/require-admin'
import { fetchPortfolioFresh } from '@/lib/portfolio-data'
import { getBlogPostViews, getOverviewStats } from '@/lib/admin-stats-data'
import { getBusinessStats } from '@/actions/business'
import { getAssistantModel, assistantProviderOptions } from '@/lib/assistant/models'
import { handleProviderError, preflight, recordUsage, releaseLock } from '@/lib/assistant/guard'
import { classifyModelError } from '@/lib/assistant/quota'
import { UsageMeter } from '@/lib/assistant/meter'
import { SYSTEM_PROMPT } from '@/lib/assistant/prompts'
import { buildAssistantTools, type AssistantDeps } from '@/lib/assistant/tools'
import { createDraft, getDraft, listDrafts, reviseDraft } from '@/lib/assistant/draft-store'
import { isConversationId, logToolCalls, saveConversation, type ToolCallLog } from '@/lib/assistant/history'
import { fetchDocumentBytes } from '@/lib/assistant/documents'
import { recentChatTranscripts } from '@/lib/chat-log'

// Admin-only assistant. Read-only on site data: its tools can look at the
// portfolio and write drafts into assistant_* collections, nothing else (see
// lib/assistant/tools.ts). Every request is bounded by lib/assistant/guard.ts
// (free-tier-sized caps, pause when Google says stop, one generation at a time).
export const maxDuration = 120

const text = (body: string, status: number, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra } })

// /api is outside the proxy's admin gate, so this route checks the session itself.
async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin()
    return true
  } catch {
    return false
  }
}

// Cookie auth + a JSON POST: refuse anything that is not from our own origin.
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true // same-origin fetches of some browsers omit it; the cookie is SameSite=Lax
  try {
    return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'))
  } catch {
    return false
  }
}

function isUiMessage(m: unknown): m is UIMessage {
  if (!m || typeof m !== 'object') return false
  const msg = m as { role?: unknown; parts?: unknown }
  return (msg.role === 'user' || msg.role === 'assistant') && Array.isArray(msg.parts)
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return text('Non autorisé.', 401)
  if (!sameOrigin(req)) return text('Origine refusée.', 403)
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return text('Requête invalide.', 415)

  const raw = await req.text()
  let gate: Awaited<ReturnType<typeof preflight>>
  try {
    gate = await preflight()
  } catch (error) {
    console.error('[admin-assistant] preflight failed:', error)
    return text("La base de données est momentanément indisponible : l'assistant ne peut pas démarrer.", 503)
  }
  if (!gate.ok) {
    return text(gate.message, gate.status, gate.retryAt ? { 'Retry-After': String(Math.max(1, Math.ceil((gate.retryAt.getTime() - Date.now()) / 1000))) } : {})
  }
  // From here on the generation lock is held: every exit must release it.
  const { limits, usedToday } = gate

  let finished = false
  const meter = new UsageMeter(usedToday, limits.dailyRequests)
  const toolLog: ToolCallLog[] = []
  let conversationId: string | null = null
  let inputTokens = 0
  let outputTokens = 0

  const finalize = async () => {
    if (finished) return
    finished = true
    await Promise.all([
      recordUsage({ requests: meter.total, inputTokens, outputTokens }),
      logToolCalls(conversationId, toolLog),
      releaseLock(),
    ])
  }

  try {
    if (raw.length > limits.maxBodyChars) {
      await finalize()
      return text('Conversation trop volumineuse : démarre une nouvelle conversation.', 413)
    }
    let body: { messages?: unknown; conversationId?: unknown } | null = null
    try { body = JSON.parse(raw) } catch { body = null }
    if (!body || !Array.isArray(body.messages) || !body.messages.every(isUiMessage) || body.messages.length === 0) {
      await finalize()
      return text('Requête invalide.', 400)
    }
    conversationId = isConversationId(body.conversationId) ? body.conversationId : null

    // Only the recent history goes back to the model (tokens are quota), starting on a user turn.
    const fullHistory = body.messages as UIMessage[]
    let messages = fullHistory.slice(-limits.maxHistoryMessages)
    while (messages.length > 1 && messages[0].role !== 'user') messages = messages.slice(1)

    // One read per request: every tool of this turn sees the same snapshot.
    let portfolio: ReturnType<typeof fetchPortfolioFresh> | null = null
    let views: ReturnType<typeof getBlogPostViews> | null = null

    const deps: AssistantDeps = {
      getPortfolio: () => (portfolio ??= fetchPortfolioFresh()),
      getBlogViews: () => (views ??= getBlogPostViews()),
      getBusinessStats: () => getBusinessStats(),
      getOverview: () => getOverviewStats(),
      drafts: { create: createDraft, get: getDraft, list: listDrafts, revise: reviseDraft },
      model: getAssistantModel(),
      providerOptions: assistantProviderOptions,
      limits,
      meter,
      conversationId,
      fetchDocument: (url) => fetchDocumentBytes(url),
      getChatTranscripts: () => recentChatTranscripts(40),
      handleModelError: (err) => handleProviderError(err),
      abortSignal: req.signal,
    }

    const result = streamText({
      model: deps.model,
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools: buildAssistantTools(deps),
      stopWhen: stepCountIs(limits.maxSteps),
      maxOutputTokens: limits.maxOutputTokens,
      // Free tier: a retry is one more request against the quota. Never retry.
      maxRetries: 0,
      providerOptions: assistantProviderOptions,
      abortSignal: req.signal,
      onError: async ({ error }) => {
        await handleProviderError(error)
        await finalize()
      },
      onAbort: async () => { await finalize() },
      onFinish: async (event) => {
        meter.chatRequests = Math.max(1, event.steps.length)
        inputTokens += event.totalUsage?.inputTokens ?? 0
        outputTokens += event.totalUsage?.outputTokens ?? 0
        for (const step of event.steps) {
          for (const call of step.toolCalls) {
            const out = step.toolResults.find((r) => r.toolCallId === call.toolCallId)?.output as { error?: unknown } | undefined
            toolLog.push({ tool: call.toolName, summary: JSON.stringify(call.input ?? {}), ok: !(out && typeof out === 'object' && 'error' in out) })
          }
        }
        await finalize()
      },
    })

    return result.toUIMessageStreamResponse({
      // The whole conversation (not just the recent window sent to the model) is what gets logged.
      originalMessages: fullHistory,
      headers: { 'Cache-Control': 'no-store' },
      // What the admin sees if the stream fails midway: the plain-language reason.
      onError: (error) => classifyModelError(error).message,
      onFinish: ({ messages: all }) => (conversationId ? saveConversation(conversationId, all) : undefined),
    })
  } catch (error) {
    await handleProviderError(error).catch(() => undefined)
    await finalize()
    return text(classifyModelError(error).message, 500)
  }
}
