import { describe, it, expect } from 'vitest'
import { START_CARDS, SLASH_COMMANDS, commandByName, exactCommand, isCommandInput, matchCommands } from '@/lib/assistant/commands'
import { diffStats, diffText } from '@/lib/text-diff'

describe('slash commands', () => {
  it('opens on a bare slash and lists every command', () => {
    expect(isCommandInput('/')).toBe(true)
    expect(matchCommands('/')).toHaveLength(SLASH_COMMANDS.length)
  })

  it('filters by the start of the name, ignoring case and accents', () => {
    expect(matchCommands('/re').map((c) => c.name)).toEqual(['relance', 'reecrire'])
    expect(matchCommands('/RÉ').map((c) => c.name)).toEqual(['relance', 'reecrire'])
    expect(matchCommands('/zzz')).toEqual([])
  })

  it('is not a command once the admin writes a sentence', () => {
    expect(isCommandInput('/relance pour Mbeki')).toBe(false)
    expect(isCommandInput('bonjour /relance')).toBe(false)
    expect(matchCommands('bonjour')).toEqual([])
    expect(exactCommand('/relance suite')).toBeNull()
  })

  it('recognises a command typed in full', () => {
    expect(exactCommand('/relance')?.name).toBe('relance')
    expect(exactCommand('/Relance')?.name).toBe('relance')
    expect(exactCommand('/rel')).toBeNull()
  })

  it('has unique names, a prepared prompt each, and an unfinished sentence for the fill mode', () => {
    const names = SLASH_COMMANDS.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
    for (const c of SLASH_COMMANDS) {
      expect(c.name, c.name).toMatch(/^[a-z]+$/)
      expect(c.prompt.length, c.name).toBeGreaterThan(10)
      if (c.mode === 'fill') expect(c.prompt, c.name).toMatch(/: $/)
    }
  })

  it('points every start card at a real command', () => {
    expect(START_CARDS).toHaveLength(4)
    for (const card of START_CARDS) expect(commandByName(card.command), card.key).toBeDefined()
  })

  it('never asks the model to send or publish anything', () => {
    for (const c of SLASH_COMMANDS) expect(c.prompt, c.name).not.toMatch(/\b(envoie|publie|supprime|efface)\b/i)
  })
})

describe('text diff', () => {
  it('returns nothing for two empty texts and one same segment for equal texts', () => {
    expect(diffText('', '')).toEqual([])
    expect(diffText('Bonjour le monde', 'Bonjour le monde')).toEqual([{ kind: 'same', text: 'Bonjour le monde' }])
  })

  it('marks replaced words as removed then added, keeping the rest', () => {
    const segments = diffText('Next.js et le SEO : guide', 'Next.js 16 et le SEO : réglages')
    expect(segments.map((s) => s.kind)).toContain('add')
    expect(segments.map((s) => s.kind)).toContain('del')
    const rebuiltBefore = segments.filter((s) => s.kind !== 'add').map((s) => s.text).join('')
    const rebuiltAfter = segments.filter((s) => s.kind !== 'del').map((s) => s.text).join('')
    expect(rebuiltBefore).toBe('Next.js et le SEO : guide')
    expect(rebuiltAfter).toBe('Next.js 16 et le SEO : réglages')
  })

  it('rebuilds both texts exactly, whatever the edit', () => {
    const before = 'Un site rapide.\nMais invisible sur Google.\nVoici pourquoi.'
    const after = 'Un site rapide et propre.\nVoici pourquoi.\nEt comment corriger.'
    const segments = diffText(before, after)
    expect(segments.filter((s) => s.kind !== 'add').map((s) => s.text).join('')).toBe(before)
    expect(segments.filter((s) => s.kind !== 'del').map((s) => s.text).join('')).toBe(after)
  })

  it('counts added and removed words', () => {
    const stats = diffStats(diffText('un deux trois', 'un quatre trois cinq'))
    expect(stats).toEqual({ added: 2, removed: 1, changed: true })
    expect(diffStats(diffText('pareil', 'pareil')).changed).toBe(false)
  })

  it('falls back to lines on very long texts instead of freezing', () => {
    const before = Array.from({ length: 3000 }, (_, i) => `mot${i}`).join(' ')
    const after = before.replace('mot1500', 'changé')
    const t0 = Date.now()
    const segments = diffText(before, `${after} fin`)
    expect(Date.now() - t0).toBeLessThan(3000)
    expect(segments.filter((s) => s.kind !== 'del').map((s) => s.text).join('')).toBe(`${after} fin`)
  })
})
