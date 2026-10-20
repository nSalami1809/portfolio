import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UIMessage } from 'ai'

interface Doc { conversationId: string; messages: unknown[]; leadNotified?: boolean; read?: boolean }
const store = new Map<string, Doc>()
vi.mock('@/lib/mongodb', () => ({
  getDb: async () => ({
    collection: () => ({
      createIndex: async () => 'ok',
      updateOne: async (q: { conversationId: string }, u: { $set: Record<string, unknown>; $setOnInsert?: Record<string, unknown> }) => {
        const d = store.get(q.conversationId) ?? ({ conversationId: q.conversationId, ...(u.$setOnInsert ?? {}) } as Doc)
        Object.assign(d, u.$set)
        store.set(q.conversationId, d)
        return { matchedCount: 1 }
      },
      findOneAndUpdate: async (q: { conversationId: string; leadNotified?: { $ne: boolean } }, u: { $set: Partial<Doc> }) => {
        const d = store.get(q.conversationId)
        if (!d || (q.leadNotified && d.leadNotified === true)) return null
        Object.assign(d, u.$set)
        return d
      },
    }),
  }),
}))
const { notify } = vi.hoisted(() => ({ notify: vi.fn(async () => undefined) }))
vi.mock('@/lib/push', () => ({ notifyAdmin: notify }))

import { saveChatConversation } from '@/lib/chat-log'
import { shouldAlertLead, leadSignals } from '@/lib/chat-triage'

const ID = 'abcdefghijklmnop1234'
const m = (role: 'user' | 'assistant', text: string): UIMessage => ({ id: Math.random().toString(36), role, parts: [{ type: 'text', text }] })
const tool = (name: string): UIMessage => ({ id: Math.random().toString(36), role: 'assistant', parts: [{ type: 'text', text: 'Voilà.' }, { type: `tool-${name}`, toolCallId: 't', state: 'output-available', input: {}, output: {} } as never] })

beforeEach(() => { store.clear(); notify.mockClear() })

describe('which conversations alert the admin', () => {
  it('a contact left or a quote does; a booking or a help request does not (they alert on their own)', () => {
    const sig = (...msgs: { role: 'user' | 'assistant'; text: string }[]) => shouldAlertLead(leadSignals(msgs))
    expect(sig({ role: 'user', text: 'Écrivez-moi à awa@studio.example' })).toBe(true)
    expect(sig({ role: 'user', text: 'Un site' }, { role: 'assistant', text: 'Devis prêt\n[generateQuote]' })).toBe(true)
    expect(sig({ role: 'assistant', text: 'Réservé\n[bookMeeting]' })).toBe(false)
    expect(sig({ role: 'assistant', text: '[requestHumanHelp]' })).toBe(false)
    expect(sig({ role: 'user', text: 'Bonjour' })).toBe(false)
  })
})

describe('the lead alert', () => {
  it('sends one push when a visitor leaves an address, without the address in it', async () => {
    await saveChatConversation(ID, 'fr', [m('user', 'Je veux un site, écrivez-moi à awa@studio-mbeki.example'), m('assistant', 'Bien noté.')])
    expect(notify).toHaveBeenCalledTimes(1)
    const call = (notify.mock.calls[0] as unknown as [{ title: string; body: string; url: string }])[0]
    expect(call.title).toBe('Contact possible dans le chatbot')
    expect(call.url).toBe('/admin/chats')
    expect(call.body).not.toContain('awa@studio-mbeki.example')
    expect(call.body).toContain('[e-mail]')
  })

  it('does not alert again for the same conversation', async () => {
    const chat = [m('user', 'Mon mail : awa@studio-mbeki.example'), m('assistant', 'Merci')]
    await saveChatConversation(ID, 'fr', chat)
    await saveChatConversation(ID, 'fr', [...chat, m('user', 'Et mon tel +241 06 12 34 56'), m('assistant', 'Noté')])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(store.get(ID)!.leadNotified).toBe(true)
  })

  it('alerts for a generated quote, and stays silent for a plain chat or a booking', async () => {
    await saveChatConversation(ID, 'fr', [m('user', 'Un site vitrine'), tool('generateQuote')])
    expect(notify).toHaveBeenCalledTimes(1)
    await saveChatConversation('plainchat0000000001', 'fr', [m('user', 'Quels sont vos projets ?'), m('assistant', 'Voici.')])
    await saveChatConversation('booking00000000001', 'fr', [m('user', 'Jeudi ?'), tool('bookMeeting')])
    expect(notify).toHaveBeenCalledTimes(1)
  })
})
