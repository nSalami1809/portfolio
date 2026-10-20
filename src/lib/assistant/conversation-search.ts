// Searching the assistant's conversation list (client side, over what is already loaded).
// Pure: ignores case and accents, looks at the whole text of the conversation, and keeps
// the pinned ones first in the order they already have.
import type { ConversationDTO } from '@/lib/assistant/history'

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export function conversationTitle(c: Pick<ConversationDTO, 'messages'>): string {
  const first = c.messages.find((m) => m.role === 'user')?.text ?? c.messages[0]?.text ?? 'Conversation'
  return first.replace(/\s+/g, ' ').slice(0, 60)
}

/** Conversations whose text contains every word typed, pinned ones first. An empty query keeps all. */
export function filterConversations(items: ConversationDTO[], query: string): ConversationDTO[] {
  const words = normalize(query).split(' ').filter(Boolean)
  const kept = words.length === 0
    ? items
    : items.filter((c) => {
        const haystack = normalize(c.messages.map((m) => m.text).join(' '))
        return words.every((w) => haystack.includes(w))
      })
  return [...kept.filter((c) => c.pinned), ...kept.filter((c) => !c.pinned)]
}
