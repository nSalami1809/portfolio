import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  PATCH_FIELDS, SLUG_RE, finalizeBlogDraft, fingerprint, readPatchTarget, readTimeOf, sanitizeMarkdown, slugify, uniqueSlug, type BlogModelOutput,
} from '@/lib/assistant/drafts'
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

// ── The public blog only renders a small subset of Markdown ────────────────────────────────────

import { cleanPatchText, toBlogMarkdown } from '@/lib/assistant/drafts'
import { BLOG_WRITER_SYSTEM, PATCH_SYSTEM, REVISER_SYSTEM } from '@/lib/assistant/prompts'

describe('toBlogMarkdown — what the blog page cannot display is turned into plain text', () => {
  it('turns bullet and numbered lists into lines the page shows properly', () => {
    expect(toBlogMarkdown('Intro\n\n- un\n* deux\n+ trois\n  - imbriqué\n\n1. premier\n2) second')).toBe('Intro\n\n• un\n• deux\n• trois\n• imbriqué\n\n1. premier\n2. second')
  })

  it('unwraps code fences and inline code, links and quotes', () => {
    const md = 'Voir [la doc](https://example.com/doc) et `npm run build`.\n\n```ts\nconst a = 1\n  const b = 2\n```\n\n> une citation'
    expect(toBlogMarkdown(md)).toBe('Voir la doc (https://example.com/doc) et npm run build.\n\nconst a = 1\nconst b = 2\n\nune citation')
  })

  it('removes italics but keeps bold, headings, rules and normal punctuation', () => {
    const md = '## Titre\n\nDu *texte en italique*, du _autre italique_ et du **gras**.\n\n---\n\n### Sous-titre\n\nUn prix de 3*4 = 12 et snake_case_name restent.'
    const out = toBlogMarkdown(md)
    expect(out).toContain('## Titre')
    expect(out).toContain('Du texte en italique, du autre italique et du **gras**.')
    expect(out).toContain('---')
    expect(out).toContain('### Sous-titre')
    expect(out).toContain('snake_case_name')
    expect(out).toContain('3*4 = 12')
  })

  it('brings deeper headings back to the three levels the page knows', () => {
    expect(toBlogMarkdown('#### Détail\n\n##### Encore')).toBe('### Détail\n\n### Encore')
  })

  it('leaves text that is already in the blog format exactly as it is', () => {
    const ok = '## Contexte\n\nUn paragraphe avec du **gras**.\n\n---\n\n### Suite\n\nUne autre phrase.'
    expect(toBlogMarkdown(ok)).toBe(ok)
  })

  it('is applied to a generated article, whatever the model wrote', () => {
    const { payload } = finalizeBlogDraft(
      { title: 'Un titre assez long pour passer', slug: 'un-titre', category: 'Dev', excerpt: 'Un extrait assez long pour passer la validation du blog.', unverifiedClaims: [], content: '## A\n\n- point un\n- point deux\n\n```js\nx()\n```\n\n' + 'Une phrase de test suffisamment longue pour le contenu. '.repeat(10) },
      { existingSlugs: [], categories: [] },
    )
    expect(payload.fr.content).not.toMatch(/^\s*[-*]\s|```|\]\(/m)
    expect(payload.fr.content).toContain('• point un')
  })

  it('only the body of an article gets this treatment when rewriting a field', () => {
    expect(cleanPatchText({ section: 'blog', field: 'content' }, '- a\n- b')).toBe('• a\n• b')
    expect(cleanPatchText({ section: 'blog', field: 'excerpt' }, '- a')).toBe('- a')
    expect(cleanPatchText({ section: 'projects', field: 'description' }, '- a')).toBe('- a')
  })

  it('tells the model about the format, and no longer invites lists or code', () => {
    expect(BLOG_WRITER_SYSTEM).toMatch(/N'utilise PAS de listes/)
    expect(BLOG_WRITER_SYSTEM).not.toMatch(/listes courtes|blocs de code seulement/)
    expect(REVISER_SYSTEM).toMatch(/ni liste, ni lien, ni code/)
    expect(PATCH_SYSTEM).toMatch(/ni liste, ni lien, ni code/)
  })
})
