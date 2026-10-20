'use server'

import { checkRateLimit } from '@/lib/quotes-core'
import { isConversationId, saveChatFeedback } from '@/lib/chat-log'

const FEEDBACK_PER_HOUR = 60

// A visitor's thumb up / down on one answer of the chatbot. Public by design (visitors
// are anonymous) and as narrow as it can be: it can only mark an answer that is part
// of the conversation whose random id the caller holds, stores one short word, and is
// rate-limited per IP. It never creates anything and returns nothing about the data.
export async function rateChatMessage(input: { conversationId: string; answer: string; rating: 'up' | 'down' | 'none' }): Promise<{ ok: boolean }> {
  try {
    if (!input || !isConversationId(input.conversationId)) return { ok: false }
    if (typeof input.answer !== 'string' || input.answer.length === 0 || input.answer.length > 6000) return { ok: false }
    if (input.rating !== 'up' && input.rating !== 'down' && input.rating !== 'none') return { ok: false }
    if (!(await checkRateLimit('chat-feedback', FEEDBACK_PER_HOUR))) return { ok: false }
    return { ok: await saveChatFeedback(input.conversationId, input.answer, input.rating) }
  } catch (e) {
    console.error('[chat-feedback] failed:', e)
    return { ok: false }
  }
}
