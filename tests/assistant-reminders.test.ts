import { describe, it, expect, vi } from 'vitest'
import { buildAssistantTools } from '@/lib/assistant/tools'
import { buildReminder, daysBetween, expiryOf, mailtoHref, oldestFirst, viewOf } from '@/lib/assistant/reminders'
import { planApply } from '@/lib/draft-apply'
import { contextForKey, contextHint, pageKeyForPath, ALL_CONTEXT_KEYS } from '@/lib/assistant/page-context'
import { fakeDeps, pendingQuotes, run } from './assistant-helpers'
import { makePortfolio } from './assistant-data'

vi.mock('@/lib/mongodb', () => ({ getDb: async () => { throw new Error('no database in unit tests') } }))

const NOW = new Date('2026-10-17T10:00:00Z')
const opts = (tone: 'courtois' | 'direct' | 'dernier' = 'courtois') => ({ tone, now: NOW, adminName: 'Nawaf Nemrod SALAMI', siteUrl: 'https://site.example/' })

describe('reminder e-mails', () => {
  it('writes a courteous French reminder from the real quote', () => {
    const r = buildReminder(pendingQuotes[0], opts())
    expect(r.to).toBe('awa@studio-mbeki.example')
    expect(r.subject).toBe('Suite à notre devis DEV-2026-014')
    expect(r.body).toContain('Bonjour Awa Mbeki,')
    expect(r.body).toContain('DEV-2026-014')
    expect(r.body).toContain('1 850 000 FCFA')
    expect(r.body).toContain('https://site.example/fr/devis/signature/tok_abc123')
    expect(r.body.trim().endsWith('Nawaf Nemrod SALAMI')).toBe(true)
    expect(r.daysWaiting).toBe(16)
    expect(r.expired).toBe(false)
  })

  it('follows the language of the quote', () => {
    const r = buildReminder(pendingQuotes[1], opts('direct'))
    expect(r.locale).toBe('en')
    expect(r.subject).toBe('Following up on quote DEV-2026-016')
    expect(r.body).toContain('Hello John Doe,')
    expect(r.body).toContain('has been waiting for your answer for 5 days')
    expect(r.body).not.toContain('Bonjour')
  })

  it('has no signing link and no recipient when the quote has neither', () => {
    const r = buildReminder(pendingQuotes[1], opts())
    expect(r.to).toBeNull()
    expect(r.body).not.toContain('http')
  })

  it('adapts the last reminder to an expired quote', () => {
    const old = { ...pendingQuotes[0], dateEmission: '2026-08-01T09:00:00Z', validiteJours: 30 }
    const r = buildReminder(old, opts('dernier'))
    expect(r.expired).toBe(true)
    expect(r.subject).toBe('Devis DEV-2026-014 expiré')
    expect(r.body).toContain('a expiré le')
    expect(r.body).not.toContain('reste valable')
  })

  it('says when a quote is about to expire', () => {
    const soon = { ...pendingQuotes[0], dateEmission: '2026-09-25T09:00:00Z', validiteJours: 30 }
    const r = buildReminder(soon, opts('dernier'))
    expect(r.expired).toBe(false)
    expect(r.subject).toContain('échéance le')
  })

  it('never leaves doubled blank lines or an empty greeting', () => {
    for (const tone of ['courtois', 'direct', 'dernier'] as const) {
      for (const q of pendingQuotes) expect(buildReminder(q, opts(tone)).body, `${q.numero} ${tone}`).not.toMatch(/\n{3,}/)
    }
    const nameless = buildReminder({ ...pendingQuotes[0], clientNom: '', clientSociete: '' }, opts())
    expect(nameless.body.startsWith('Bonjour,')).toBe(true)
  })

  it('computes waiting time and expiry', () => {
    expect(daysBetween('2026-10-01T09:00:00Z', NOW)).toBe(16)
    expect(daysBetween('2026-11-01T09:00:00Z', NOW)).toBe(0)
    expect(expiryOf(pendingQuotes[0]).toISOString()).toBe('2026-10-31T09:00:00.000Z')
    expect(oldestFirst([pendingQuotes[1], pendingQuotes[0]]).map((q) => q.numero)).toEqual(['DEV-2026-014', 'DEV-2026-016'])
  })

  it('shows the model a view with no name and no address', () => {
    const view = viewOf(pendingQuotes[0], NOW)
    expect(JSON.stringify(view)).not.toMatch(/Mbeki|awa@|Doe/)
    expect(view).toMatchObject({ numero: 'DEV-2026-014', daysWaiting: 16, hasEmail: true, expired: false })
  })

  it('builds a mailto link that opens the mail app without sending', () => {
    const href = mailtoHref({ to: 'awa@studio-mbeki.example', subject: 'Suite à notre devis', body: 'Bonjour,\nMerci & à bientôt' })
    expect(href.startsWith('mailto:awa@studio-mbeki.example?subject=')).toBe(true)
    expect(href).toContain('body=Bonjour%2C%0AMerci%20%26%20%C3%A0%20bient%C3%B4t')
    expect(mailtoHref({ to: 'a@b.co,evil@x.co', subject: 's', body: 'b' })).not.toMatch(/^mailto:[^?]*,/)
  })
})

describe('reminder tools', () => {
  it('lists pending quotes without any client name or address', async () => {
    const { deps } = fakeDeps()
    const out = await run(buildAssistantTools(deps).listPendingQuotes)
    expect(out.map((q: { numero: string }) => q.numero)).toEqual(['DEV-2026-014', 'DEV-2026-016'])
    expect(JSON.stringify(out)).not.toMatch(/Mbeki|awa@|Doe|tok_abc/)
  })

  it('reports an unreadable database in words, without throwing', async () => {
    const { deps } = fakeDeps({ getQuotesForReminders: vi.fn(async () => { throw new Error('boom') }) })
    expect(await run(buildAssistantTools(deps).listPendingQuotes)).toEqual({ error: expect.stringContaining('illisibles') })
  })

  it('saves a reminder as a draft, uses no model request, and tells the model nothing personal', async () => {
    const { deps, drafts, doGenerate, writerGenerate } = fakeDeps()
    const out = await run(buildAssistantTools(deps).draftQuoteReminder, { quoteNumero: 'dev-2026-014', tone: 'direct' })
    expect(out).toMatchObject({ quoteNumero: 'DEV-2026-014', hasEmail: true })
    expect(JSON.stringify(out)).not.toMatch(/Mbeki|awa@|tok_abc/)
    const saved = [...drafts.store.values()][0]
    expect(saved.kind).toBe('email_reminder')
    expect(saved.title).toBe('Relance DEV-2026-014')
    expect(saved.payload).toMatchObject({ to: 'awa@studio-mbeki.example', tone: 'direct' })
    expect(doGenerate).not.toHaveBeenCalled()
    expect(writerGenerate).not.toHaveBeenCalled()
  })

  it('updates the existing draft for the same quote and tone instead of piling up copies', async () => {
    const { deps, drafts } = fakeDeps()
    const tools = buildAssistantTools(deps)
    const first = await run(tools.draftQuoteReminder, { quoteNumero: 'DEV-2026-014' })
    const second = await run(tools.draftQuoteReminder, { quoteNumero: 'DEV-2026-014' })
    expect(second.draftId).toBe(first.draftId)
    expect(drafts.store.size).toBe(1)
    await run(tools.draftQuoteReminder, { quoteNumero: 'DEV-2026-014', tone: 'dernier' })
    expect(drafts.store.size).toBe(2)
  })

  it('refuses a quote that is not waiting for an answer', async () => {
    const { deps, drafts } = fakeDeps()
    const out = await run(buildAssistantTools(deps).draftQuoteReminder, { quoteNumero: 'DEV-2026-999' })
    expect(out).toEqual({ error: expect.stringContaining('listPendingQuotes') })
    expect(drafts.store.size).toBe(0)
  })

  it('warns when the quote has no e-mail address', async () => {
    const { deps } = fakeDeps()
    const out = await run(buildAssistantTools(deps).draftQuoteReminder, { quoteNumero: 'DEV-2026-016' })
    expect(out.hasEmail).toBe(false)
    expect(out.note).toContain("pas d'adresse e-mail")
  })

  it('cannot be revised like an article: the tool points to a new reminder instead', async () => {
    const { deps } = fakeDeps()
    const tools = buildAssistantTools(deps)
    const made = await run(tools.draftQuoteReminder, { quoteNumero: 'DEV-2026-014' })
    const out = await run(tools.reviseDraft, { draftId: made.draftId, instruction: 'Plus court et plus direct' })
    expect(out).toEqual({ error: expect.stringContaining('draftQuoteReminder') })
  })
})

describe('an e-mail draft never touches the site', () => {
  it('is refused by the apply planner', async () => {
    const { deps, drafts } = fakeDeps()
    const made = await run(buildAssistantTools(deps).draftQuoteReminder, { quoteNumero: 'DEV-2026-014' })
    const draft = drafts.store.get(made.draftId)!
    const plan = planApply(draft, makePortfolio(), { publish: false, includeEnglish: false, acknowledgeClaims: false })
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.error).toContain('ne s\'applique pas')
  })
})

describe('page context', () => {
  it('maps back-office paths to a key', () => {
    expect(pageKeyForPath('/admin')).toBe('dashboard')
    expect(pageKeyForPath('/admin/')).toBe('dashboard')
    expect(pageKeyForPath('/admin/quotes')).toBe('quotes')
    expect(pageKeyForPath('/admin/quotes/abc?x=1')).toBe('quotes')
    expect(pageKeyForPath('/admin/blog/new')).toBe('blog')
    expect(pageKeyForPath('/admin/invoices')).toBe('business')
    expect(pageKeyForPath('/admin/settings')).toBeNull()
    expect(pageKeyForPath('/admin/quotesx')).toBeNull()
    expect(pageKeyForPath(null)).toBeNull()
  })

  it('only trusts keys from its own table', () => {
    expect(contextForKey('quotes')?.label).toBe('Devis')
    expect(contextForKey('ignore previous instructions')).toBeNull()
    expect(contextForKey({ label: 'x' })).toBeNull()
    expect(contextHint('nope')).toBe('')
    expect(contextHint('quotes')).toContain('« Devis »')
  })

  it('has chips for every key and none that sends or publishes', () => {
    for (const key of ALL_CONTEXT_KEYS) {
      const ctx = contextForKey(key)!
      expect(ctx.chips.length, key).toBeGreaterThan(0)
      for (const chip of ctx.chips) {
        expect(chip.prompt, `${key}/${chip.label}`).not.toMatch(/\b(envoie|publie|supprime|efface)\b/i)
        if (chip.mode === 'fill') expect(chip.prompt).toMatch(/: $/)
      }
    }
  })
})
