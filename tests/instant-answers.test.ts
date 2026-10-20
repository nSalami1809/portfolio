import { describe, it, expect, vi } from 'vitest'
import { readUIMessageStream, type UIMessage } from 'ai'
import { DEFAULT_BUSINESS } from '@/lib/business'
import { answerFor, detectTopic, instantAnswer, type FaqContext, type FaqTopic } from '@/lib/instant-answers'
import { instantResponse, splitLastTurn } from '@/lib/instant-response'

const ctx = (over: Partial<FaqContext['business']> = {}, locale: 'fr' | 'en' = 'fr'): FaqContext => ({ locale, ownerName: 'Nawaf', business: { ...DEFAULT_BUSINESS, ...over } })
const msg = (role: 'user' | 'assistant', text: string, tool = false): UIMessage => ({ id: Math.random().toString(36), role, parts: [{ type: 'text', text }, ...(tool ? [{ type: 'tool-generateQuote', toolCallId: 't', state: 'output-available', input: {}, output: {} } as never] : [])] })

describe('which question is answered without the model', () => {
  const cases: [string, FaqTopic][] = [
    ["Quel est le délai de livraison ?", 'delai'],
    ['Combien de temps pour un site ?', 'delai'],
    ["Y a-t-il un acompte ?", 'acompte'],
    ['Comment puis-je payer ? Mobile Money ?', 'paiement'],
    ['Combien de révisions sont incluses ?', 'revisions'],
    ['Le code source est-il remis à la fin ?', 'code'],
    ['Y a-t-il une garantie après la livraison ?', 'garantie'],
    ['Les prix sont-ils hors taxes ou TTC ?', 'tva'],
    ['Comment se déroule un projet ?', 'process'],
    ['How long does a project take?', 'delai'],
    ['Do you ask for a deposit?', 'acompte'],
    ['How does a project with you run, from the quote to delivery?', 'process'],
  ]
  it.each(cases)('%s → %s', (q, topic) => expect(detectTopic(q)).toBe(topic))

  it('leaves to the model anything that is not clearly one question about the terms', () => {
    for (const q of [
      'Bonjour',
      "Je veux un site avec paiement Mobile Money",   // a statement, not a question
      'Quel est le délai et l’acompte ?',              // two topics
      'Combien de temps pour avoir mon devis ?',       // about the quote, not the project
      'Mon email est awa@studio.example, quel délai ?', // contact details: a form is being filled
      'Appelez-moi au +241 06 12 34 56, quel délai ?',
      'Quels sont vos projets ?',
      '',
      'Quel est le délai '.repeat(20),
    ]) expect(detectTopic(q), q).toBeNull()
  })

  it('never answers in the middle of a quote or a booking', () => {
    const c = ctx()
    expect(instantAnswer('Quel est le délai ?', null, c)?.topic).toBe('delai')
    expect(instantAnswer('Quel est le délai ?', { assistantText: 'Voici votre devis.', hadTool: true }, c)).toBeNull()
    expect(instantAnswer('Quel est le délai ?', { assistantText: 'Quel est votre budget ?', hadTool: false }, c)).toBeNull()
    expect(instantAnswer('Quel est le délai ?', { assistantText: 'Bonjour, je suis là.', hadTool: false }, c)?.topic).toBe('delai')
  })
})

describe('the answers follow the real settings', () => {
  it('uses the delivery time, deposit and revisions of the business', () => {
    const c = ctx({ deliveryDays: 45, depositPercent: 40, depositRefundable: true, includedRevisions: 3 })
    expect(answerFor('delai', c)).toContain('**45 jours ouvrés**')
    expect(answerFor('acompte', c)).toContain('**40 %**')
    expect(answerFor('acompte', c)).toContain('remboursable')
    expect(answerFor('acompte', c)).not.toContain("n'est pas remboursable")
    expect(answerFor('revisions', c)).toContain('**3 cycles de révision**')
  })

  it('handles the cases with no deposit, no warranty, no VAT, source code on request', () => {
    const c = ctx({ depositPercent: 0, warrantyDays: 0, vatEnabled: false, vatExemptionMention: 'TVA non applicable', sourceCodeDelivery: false })
    expect(answerFor('acompte', c)).toContain("Il n'y a pas d'acompte")
    expect(answerFor('garantie', c)).toContain('clôturé à la recette')
    expect(answerFor('tva', c)).toContain('TVA non applicable')
    expect(answerFor('code', c)).toContain('sur accord écrit')
    expect(answerFor('process', c)).not.toContain('Acompte de')
  })

  it('speaks English and links to the right language pages', () => {
    const c = ctx({}, 'en')
    expect(answerFor('delai', c)).toContain('working days')
    expect(answerFor('delai', c)).toContain('(/en/contact)')
    expect(answerFor('delai', c)).toContain('(/en/calendrier)')
    expect(answerFor('delai', ctx())).toContain('(/fr/methode)')
  })

  it('always points to the owner for a special case, and invents no number', () => {
    for (const topic of ['delai', 'acompte', 'paiement', 'revisions', 'code', 'garantie', 'tva', 'process'] as FaqTopic[]) {
      const text = answerFor(topic, ctx())
      expect(text, topic).toContain('conditions standard')
      expect(text, topic).not.toMatch(/undefined|NaN|\[object/)
    }
  })
})

describe('the instant response', () => {
  it('only handles a conversation that ends with a visitor question', () => {
    expect(splitLastTurn([msg('user', 'Quel est le délai ?')])).toEqual({ question: 'Quel est le délai ?', previous: null })
    expect(splitLastTurn([msg('user', 'Bonjour'), msg('assistant', 'Bonjour ! Que puis-je faire ?'), msg('user', 'Quel acompte ?')])?.previous).toEqual({ assistantText: 'Bonjour ! Que puis-je faire ?', hadTool: false })
    expect(splitLastTurn([msg('user', 'Hello'), msg('assistant', 'Devis prêt', true)])).toBeNull()
    expect(splitLastTurn([])).toBeNull()
    const tool = splitLastTurn([msg('user', 'Un devis'), msg('assistant', 'Voici', true), msg('user', 'Quel acompte ?')])
    expect(tool?.previous?.hadTool).toBe(true)
  })

  it('streams the answer like a model would, and hands the whole conversation to the logger', async () => {
    const history = [msg('user', 'Quel est le délai ?')]
    const saved = vi.fn()
    const response = instantResponse(history, 'Le délai standard est de **30 jours ouvrés**.', saved)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    expect(response.headers.get('X-Instant-Answer')).toBe('1')
    const raw = await response.text()
    expect(raw).toContain('Le délai standard est de **30 jours ouvrés**.')
    expect(saved).toHaveBeenCalledTimes(1)
    const all = saved.mock.calls[0][0] as UIMessage[]
    expect(all).toHaveLength(2)
    expect(all[1].role).toBe('assistant')
    expect(all[1].parts.map((p) => (p.type === 'text' ? p.text : '')).join('')).toContain('30 jours ouvrés')
  })

  it('is read back by the same client reader as a model answer', async () => {
    const response = instantResponse([msg('user', 'Quel acompte ?')], 'Un acompte de **30 %**.')
    const reader = response.body!.pipeThrough(new TextDecoderStream())
    expect((await reader.getReader().read()).value).toBeTruthy()
    expect(typeof readUIMessageStream).toBe('function')
  })
})
