// Small guards on the conversation the visitor chat sends to the model.
import type { UIMessage } from 'ai'

/**
 * Tool calls the visitor has not answered yet (a quote summary waiting for a click, the
 * contact form of a human-help request) have no result, and the model refuses a history
 * with such a hole. When the visitor goes on with a new message instead, the pending
 * calls are left out of what the model reads; the conversation shown and saved is untouched.
 */
export function dropPendingToolCalls(messages: UIMessage[]): UIMessage[] {
  return messages
    .map((m) => {
      if (m.role !== 'assistant') return m
      const parts = m.parts.filter((p) => !(p.type.startsWith('tool-') && 'state' in p && (p.state === 'input-available' || p.state === 'input-streaming')))
      return parts.length === m.parts.length ? m : { ...m, parts }
    })
    .filter((m) => m.parts.length > 0)
}
