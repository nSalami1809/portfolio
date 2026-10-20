import { describe, it, expect } from 'vitest'
import type { UIMessage } from 'ai'
import { dropPendingToolCalls } from '@/lib/chat-messages'

const user = (text: string): UIMessage => ({ id: `u-${text}`, role: 'user', parts: [{ type: 'text', text }] })
const assistant = (...parts: unknown[]): UIMessage => ({ id: 'a1', role: 'assistant', parts: parts as UIMessage['parts'] })
const tool = (name: string, state: string) => ({ type: `tool-${name}`, toolCallId: `c-${name}`, state, input: {}, ...(state === 'output-available' ? { output: {} } : {}) })

describe('pending tool calls', () => {
  it('leaves out a call the visitor has not answered, keeping the text around it', () => {
    const out = dropPendingToolCalls([user('Un devis'), assistant({ type: 'text', text: 'Voici' }, tool('generateQuote', 'input-available')), user('Quel acompte ?')])
    expect(out).toHaveLength(3)
    expect(out[1].parts.map((p) => p.type)).toEqual(['text'])
  })

  it('removes an assistant message that only held a pending call', () => {
    const out = dropPendingToolCalls([user('Un devis'), assistant(tool('generateQuote', 'input-available')), user('Quel acompte ?')])
    expect(out.map((m) => m.role)).toEqual(['user', 'user'])
  })

  it('keeps answered calls, and the streaming ones are dropped like pending ones', () => {
    const out = dropPendingToolCalls([user('x'), assistant(tool('generateQuote', 'output-available'), tool('requestHumanHelp', 'input-streaming'))])
    expect(out[1].parts.map((p) => p.type)).toEqual(['tool-generateQuote'])
  })

  it('does not touch a conversation without pending calls (same objects)', () => {
    const msgs = [user('Bonjour'), assistant({ type: 'text', text: 'Salut' })]
    const out = dropPendingToolCalls(msgs)
    expect(out[0]).toBe(msgs[0])
    expect(out[1]).toBe(msgs[1])
  })
})
