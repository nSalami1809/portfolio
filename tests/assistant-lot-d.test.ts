import { describe, it, expect } from 'vitest'
import { conversationTitle, filterConversations } from '@/lib/assistant/conversation-search'
import { appendDictation, transcriptOf } from '@/lib/assistant/dictation'
import { MAX_BODY_CHARS, MAX_SUBJECT_CHARS, cleanEmailText } from '@/lib/assistant/reminders'
import { BOTTOM_NAV_ITEMS, isActiveItem, showBottomNav } from '@/components/admin/MobileBottomNav'
import type { ConversationDTO } from '@/lib/assistant/history'

const conv = (id: string, texts: string[], pinned = false): ConversationDTO => ({
  id, conversationId: `c-${id}`, createdAt: '2026-10-17T10:00:00Z', updatedAt: '2026-10-17T10:00:00Z', pinned,
  messages: texts.map((text, i) => ({ role: i % 2 === 0 ? ('user' as const) : ('assistant' as const), text })),
})

describe('searching conversations', () => {
  const items = [
    conv('1', ['Prépare un article sur Next.js', 'Voici un brouillon']),
    conv('2', ['Quels devis relancer ?', 'Le devis DEV-2026-014 attend depuis 16 jours']),
    conv('3', ['Audit du portfolio', 'Priorités : études de cas'], true),
  ]

  it('keeps everything for an empty query, pinned first', () => {
    expect(filterConversations(items, '').map((c) => c.id)).toEqual(['3', '1', '2'])
    expect(filterConversations(items, '   ').map((c) => c.id)).toEqual(['3', '1', '2'])
  })

  it('looks at the whole conversation, ignoring case and accents, every word must match', () => {
    expect(filterConversations(items, 'ETUDES cas').map((c) => c.id)).toEqual(['3'])
    expect(filterConversations(items, 'prepare article').map((c) => c.id)).toEqual(['1'])
    expect(filterConversations(items, 'devis 16 jours').map((c) => c.id)).toEqual(['2'])
    expect(filterConversations(items, 'devis audit')).toEqual([])
  })

  it('does not mutate the list it was given, and titles come from the first visitor message', () => {
    const copy = [...items]
    filterConversations(items, 'devis')
    expect(items).toEqual(copy)
    expect(conversationTitle(items[1])).toBe('Quels devis relancer ?')
    expect(conversationTitle({ messages: [] })).toBe('Conversation')
    expect(conversationTitle(conv('x', ['a '.repeat(80)])).length).toBe(60)
  })
})

describe('dictation', () => {
  it('adds the dictated sentence after what is typed, with a single space', () => {
    expect(appendDictation('', ' bonjour  tout le monde ')).toBe('bonjour tout le monde')
    expect(appendDictation('Prépare un mail  ', 'pour Awa')).toBe('Prépare un mail pour Awa')
    expect(appendDictation('Déjà écrit', '   ')).toBe('Déjà écrit')
  })

  it('reads the words of a recognition result, whatever the list type', () => {
    expect(transcriptOf([[{ transcript: 'quel devis' }], [{ transcript: ' relancer ' }]])).toBe('quel devis relancer')
    expect(transcriptOf([[], [{ transcript: 'ok' }]])).toBe('ok')
    expect(transcriptOf([])).toBe('')
  })
})

describe('edits to a reminder e-mail', () => {
  it('keeps plain text, one-line subject, line breaks in the body', () => {
    const out = cleanEmailText({ subject: '  Suite à notre\ndevis \u0000DEV-1 ', body: 'Bonjour,\r\n\r\nUn mot.\u0007\n\nCordialement' })!
    expect(out.subject).toBe('Suite à notre devis DEV-1')
    expect(out.body).toBe('Bonjour,\n\nUn mot.\n\nCordialement')
  })

  it('bounds the length and refuses an empty subject or body', () => {
    const out = cleanEmailText({ subject: 's'.repeat(500), body: 'b'.repeat(9000) })!
    expect(out.subject.length).toBe(MAX_SUBJECT_CHARS)
    expect(out.body.length).toBe(MAX_BODY_CHARS)
    expect(cleanEmailText({ subject: '   ', body: 'x' })).toBeNull()
    expect(cleanEmailText({ subject: 'x', body: ' \n ' })).toBeNull()
    expect(cleanEmailText({ subject: 12, body: 'x' })).toBeNull()
    expect(cleanEmailText({ subject: 'x', body: null })).toBeNull()
  })
})

describe('mobile bottom navigation', () => {
  it('has the four most used places, and marks the current one', () => {
    expect(BOTTOM_NAV_ITEMS.map((i) => i.href)).toEqual(['/admin', '/admin/quotes', '/admin/assistant', '/admin/chats'])
    expect(isActiveItem('/admin', '/admin')).toBe(true)
    expect(isActiveItem('/admin', '/admin/quotes')).toBe(false)
    expect(isActiveItem('/admin/quotes', '/admin/quotes')).toBe(true)
    expect(isActiveItem('/admin/quotes', '/admin/quotes/abc')).toBe(true)
    expect(isActiveItem('/admin/chats', '/admin/chatsx')).toBe(false)
  })

  it('leaves the bottom of the screen to the message box on the assistant page', () => {
    expect(showBottomNav('/admin')).toBe(true)
    expect(showBottomNav('/admin/quotes')).toBe(true)
    expect(showBottomNav('/admin/assistant')).toBe(false)
  })
})
