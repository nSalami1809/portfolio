import { describe, it, expect, vi, beforeEach } from 'vitest'

// An in-memory stand-in for the chat_conversations collection: just what the log uses.
interface Doc { conversationId: string; messages: { role: 'user' | 'assistant'; text: string }[]; read: boolean; feedback?: Record<string, string> }
const store = new Map<string, Doc>()
vi.mock('@/lib/mongodb', () => ({
  getDb: async () => ({
    collection: () => ({
      createIndex: async () => 'ok',
      findOne: async (q: { conversationId: string }) => store.get(q.conversationId) ?? null,
      updateOne: async (q: { conversationId: string }, u: { $set?: Record<string, unknown>; $unset?: Record<string, unknown> }) => {
        const d = store.get(q.conversationId)
        if (!d) return { matchedCount: 0 }
        for (const [k, v] of Object.entries(u.$set ?? {})) {
          if (k.startsWith('feedback.')) (d.feedback ??= {})[k.slice(9)] = v as string
          else (d as unknown as Record<string, unknown>)[k] = v
        }
        for (const k of Object.keys(u.$unset ?? {})) if (k.startsWith('feedback.')) delete d.feedback?.[k.slice(9)]
        return { matchedCount: 1 }
      },
    }),
  }),
}))
const { rate } = vi.hoisted(() => ({ rate: vi.fn(async () => true) }))
vi.mock('@/lib/quotes-core', () => ({ checkRateLimit: rate }))

import { feedbackKey, saveChatFeedback } from '@/lib/chat-log'
import { rateChatMessage } from '@/actions/chat-feedback'

const ID = 'abcdefghijklmnop1234'
beforeEach(() => {
  store.clear()
  rate.mockResolvedValue(true)
  store.set(ID, { conversationId: ID, read: true, messages: [{ role: 'user', text: 'Quel délai ?' }, { role: 'assistant', text: 'Le délai est de **30 jours**.\n[generateQuote]' }] })
})

describe('answer key', () => {
  it('ignores tool markers, spacing and case, so browser and server agree', () => {
    expect(feedbackKey('Le délai est de **30 jours**.\n[generateQuote]')).toBe(feedbackKey('  le  délai est de **30 JOURS**. '))
    expect(feedbackKey('Un texte')).not.toBe(feedbackKey('Un autre texte'))
    expect(feedbackKey('x')).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('thumbs on an answer', () => {
  const answer = 'Le délai est de **30 jours**.'

  it('records a thumb on an answer of the conversation', async () => {
    expect(await saveChatFeedback(ID, answer, 'up')).toBe(true)
    expect(store.get(ID)!.feedback).toEqual({ [feedbackKey(answer)]: 'up' })
    expect(store.get(ID)!.read).toBe(true)
  })

  it('a thumb down marks the conversation unread so it surfaces', async () => {
    await saveChatFeedback(ID, answer, 'down')
    expect(store.get(ID)!.read).toBe(false)
  })

  it('a second click can take the thumb back', async () => {
    await saveChatFeedback(ID, answer, 'up')
    await saveChatFeedback(ID, answer, 'none')
    expect(store.get(ID)!.feedback).toEqual({})
  })

  it('refuses an answer that is not in the conversation and an unknown conversation', async () => {
    expect(await saveChatFeedback(ID, 'Un texte inventé', 'up')).toBe(false)
    expect(await saveChatFeedback(ID, 'Quel délai ?', 'up')).toBe(false) // a visitor message is not an answer
    expect(await saveChatFeedback('zzzzzzzzzzzzzzzz9999', answer, 'up')).toBe(false)
    expect(store.get(ID)!.feedback).toBeUndefined()
  })
})

describe('the public action', () => {
  const answer = 'Le délai est de **30 jours**.'

  it('accepts a valid thumb', async () => {
    expect(await rateChatMessage({ conversationId: ID, answer, rating: 'up' })).toEqual({ ok: true })
  })

  it('rejects malformed input without touching the database', async () => {
    for (const bad of [
      { conversationId: 'short', answer, rating: 'up' },
      { conversationId: ID, answer: '', rating: 'up' },
      { conversationId: ID, answer: 'x'.repeat(7000), rating: 'up' },
      { conversationId: ID, answer, rating: 'love' },
      null,
    ]) expect(await rateChatMessage(bad as never), JSON.stringify(bad)).toEqual({ ok: false })
    expect(store.get(ID)!.feedback).toBeUndefined()
  })

  it('stops once the hourly limit is reached', async () => {
    rate.mockResolvedValue(false)
    expect(await rateChatMessage({ conversationId: ID, answer, rating: 'up' })).toEqual({ ok: false })
    expect(store.get(ID)!.feedback).toBeUndefined()
  })
})
