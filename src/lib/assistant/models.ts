import { google } from '@ai-sdk/google'
import { resolveAssistantModelId } from '@/lib/assistant/config'

// The one place that knows which provider the assistant talks to. Switching to
// another model family later means changing this file (and config.ts's
// allowlist) — the agent, tools, drafts and UI only ever see a LanguageModel.
// There is deliberately no fallback chain: when the free quota is used up the
// assistant stops and says so (see quota.ts) instead of trying anything else.
export function getAssistantModel() {
  return google(resolveAssistantModelId())
}

// Gemini 3.x "thinks" before answering and those tokens count against the
// free quota. Low is plenty for reading a portfolio and drafting text.
export const assistantProviderOptions = {
  google: { thinkingConfig: { thinkingLevel: 'low' as const } },
}
