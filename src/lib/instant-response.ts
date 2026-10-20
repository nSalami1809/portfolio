// Turns an instant answer into the same streamed response the model would have given,
// so the chat window, the saved conversation and the admin's log treat it like any other
// answer. Nothing here talks to a model.
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai'
import type { PreviousTurn } from '@/lib/instant-answers'

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('').trim()

/**
 * The visitor's question (the conversation must END with their message, otherwise this
 * is the automatic follow-up of a tool call) and what the assistant said just before.
 */
export function splitLastTurn(messages: UIMessage[]): { question: string; previous: PreviousTurn | null } | null {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'user') return null
  const question = textOf(last)
  if (!question) return null
  const before = messages[messages.length - 2]
  const previous: PreviousTurn | null = before && before.role === 'assistant'
    ? { assistantText: textOf(before), hadTool: before.parts.some((p) => p.type.startsWith('tool-')) }
    : null
  return { question, previous }
}

export function instantResponse(messages: UIMessage[], text: string, onFinish?: (all: UIMessage[]) => void | Promise<void>): Response {
  const id = `instant-${messages.length}`
  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: ({ writer }) => {
      writer.write({ type: 'text-start', id })
      writer.write({ type: 'text-delta', id, delta: text })
      writer.write({ type: 'text-end', id })
    },
    onEnd: onFinish ? ({ messages: all }) => onFinish(all) : undefined,
  })
  return createUIMessageStreamResponse({ stream, headers: { 'Cache-Control': 'no-store', 'X-Instant-Answer': '1' } })
}
