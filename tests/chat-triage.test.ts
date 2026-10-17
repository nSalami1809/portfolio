import { describe, it, expect } from 'vitest'
import { CHAT_TAGS, CHAT_TAG_LABEL, matchesFilter, triageChat } from '@/lib/chat-triage'
import type { ChatLogMessage } from '@/lib/chat-log'

const u = (text: string): ChatLogMessage => ({ role: 'user', text })
const a = (text: string): ChatLogMessage => ({ role: 'assistant', text })

describe('chat triage', () => {
  it('recognises a quote request from the tool marker or the words', () => {
    expect(triageChat([u('Je veux un site vitrine pour mon cabinet'), a('Voici le devis.\n[generateQuote]')]).tag).toBe('devis')
    expect(triageChat([u('Pouvez-vous me faire un devis ?'), a('Bien sûr.')]).tag).toBe('devis')
    expect(triageChat([u('I need a quote for a shop'), a('Sure')]).tag).toBe('devis')
  })

  it('puts a request to talk to a human first, even when prices are mentioned', () => {
    const t = triageChat([u('Je veux parler à Nawaf, le prix est trop flou'), a('[requestHumanHelp]')])
    expect(t.tag).toBe('humain')
    expect(t.lead).toBe(true)
  })

  it('tags bookings, follow-ups, prices, tech and background', () => {
    expect(triageChat([u('Quels sont vos créneaux ?'), a('[checkAvailability]')]).tag).toBe('rdv')
    expect(triageChat([u('Où en est mon projet ?'), a('[lookupQuote]')]).tag).toBe('suivi')
    expect(triageChat([u('Combien coûte un site e-commerce ?'), a('Entre…')]).tag).toBe('tarifs')
    expect(triageChat([u('Vous faites du React avec une base de données ?'), a('Oui')]).tag).toBe('technique')
    expect(triageChat([u('Parle-moi de ton parcours'), a('Je suis…')]).tag).toBe('parcours')
    expect(triageChat([u('Salut'), a('Bonjour !')]).tag).toBe('autre')
  })

  it('detects a lead when the visitor leaves an e-mail or a phone number, or a booking was made', () => {
    expect(triageChat([u('Écrivez-moi à awa@studio.example'), a('Noté')]).lead).toBe(true)
    expect(triageChat([u('Appelez-moi au +241 06 12 34 56'), a('Noté')]).lead).toBe(true)
    expect(triageChat([u('Un rendez-vous jeudi'), a('Réservé\n[bookMeeting]')]).lead).toBe(true)
    expect(triageChat([u('Bonjour'), a('Bonjour')]).lead).toBe(false)
  })

  it('flags answers where the bot gave up', () => {
    expect(triageChat([u('Quel est votre numéro de TVA ?'), a("Je n'ai pas cette information.")]).unanswered).toBe(true)
    expect(triageChat([u('Do you do Rust?'), a("I don't know that one.")]).unanswered).toBe(true)
    expect(triageChat([u('Bonjour'), a('Bonjour, que puis-je faire ?')]).unanswered).toBe(false)
  })

  it('summarises with the first visitor message, hiding contact details and shortening', () => {
    const t = triageChat([a('Bonjour'), u('Contactez awa@studio.example ou +241 06 12 34 56 pour mon site ' + 'très long '.repeat(30))])
    expect(t.summary).not.toMatch(/awa@|\+241/)
    expect(t.summary).toContain('[e-mail]')
    expect(t.summary).toContain('[téléphone]')
    expect(t.summary.length).toBeLessThanOrEqual(120)
    expect(t.summary.endsWith('…')).toBe(true)
  })

  it('copes with an empty conversation', () => {
    expect(triageChat([])).toEqual({ tag: 'autre', lead: false, unanswered: false, summary: '' })
  })

  it('filters by lead, unanswered and tag', () => {
    const t = triageChat([u('Un devis svp'), a("Je n'ai pas cette information.\n[generateQuote]")])
    expect(matchesFilter(t, 'all')).toBe(true)
    expect(matchesFilter(t, 'lead')).toBe(true)
    expect(matchesFilter(t, 'unanswered')).toBe(true)
    expect(matchesFilter(t, 'devis')).toBe(true)
    expect(matchesFilter(t, 'rdv')).toBe(false)
  })

  it('has a label for every tag', () => {
    for (const tag of CHAT_TAGS) expect(CHAT_TAG_LABEL[tag], tag).toBeTruthy()
  })
})
