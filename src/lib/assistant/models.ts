import { google } from '@ai-sdk/google'
import { resolveAssistantModelId, resolveWriterModelId } from '@/lib/assistant/config'
import { limitModel } from '@/lib/assistant/limiter'

// The one place that knows which provider the assistant talks to. Switching to
// another model family later means changing this file (and config.ts's
// allowlist and limits) — the agent, tools, drafts and UI only ever see a
// LanguageModel. Both models are wrapped by the request limiter: nothing reaches
// Google without having been counted against that model's free quota.
// There is deliberately no fallback chain: when a quota is used up the assistant
// stops and says so (see quota.ts) instead of trying anything else.

/** Chat, tools, audits, documents, conversations and translations. */
export function getChatModel() {
  const id = resolveAssistantModelId()
  return limitModel(google(id), id)
}

/** Writing and revising articles only. */
export function getWriterModel() {
  const id = resolveWriterModelId()
  return limitModel(google(id), id)
}

// Gemini 3.x "thinks" before answering and those tokens count against the free
// quota. Low is plenty for reading a portfolio and drafting text (accepted by
// gemini-3.1-flash-lite: checked with a real request on 2026-10-17).
export const assistantProviderOptions = {
  google: { thinkingConfig: { thinkingLevel: 'low' as const } },
}
