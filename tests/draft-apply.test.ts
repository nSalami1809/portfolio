import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { PortfolioData } from '@/types'
import type { BlogPayload, DraftDTO, PatchPayload } from '@/lib/assistant/drafts'
import { fingerprint } from '@/lib/assistant/drafts'
import {
  BLOG_TRANSLATION_FIELD_SETS, applyDraft, planApply, undoDraft,
  type ApplyOptions, type ApplyPorts, type AppliedRecord, type UndoPorts,
} from '@/lib/draft-apply'
import { article, english } from './assistant-helpers'
import { makePortfolio } from './assistant-data'

// Collections of the fake database: enough of Mongo's updateOne/findOne for the two
// writers below (portfolio-write.ts, portfolio-data.ts).
const db = vi.hoisted(() => {
  const state = { doc: null as Record<string, unknown> | null, calls: [] as { filter: Record<string, unknown>; update: Record<string, unknown> }[] }
  const collection = {
    findOne: async () => state.doc,
    updateOne: async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      state.calls.push({ filter, update })
      const doc = state.doc
      if (!doc) return { matchedCount: 0 }
      const wanted = filter.updatedAt as Date | { $exists: boolean } | undefined
      const current = doc.updatedAt as Date | undefined
      const matches = wanted instanceof Date ? current instanceof Date && current.getTime() === wanted.getTime() : wanted && 'enabled' in wanted ? false : wanted && (wanted as { $exists: boolean }).$exists === false ? current === undefined : true
      if (!matches) return { matchedCount: 0 }
      Object.assign(doc, (update as { $set: Record<string, unknown> }).$set)
      return { matchedCount: 1 }
    },
  }
  return { state, collection }
})
vi.mock('@/lib/mongodb', () => ({ getDb: async () => ({ collection: () => db.collection }) }))

import { translationHash } from '@/lib/translate'
import { readPortfolioWithVersion } from '@/lib/portfolio-data'
import { replacePortfolioKey } from '@/lib/portfolio-write'

const OPTS: ApplyOptions = { publish: false, includeEnglish: true, acknowledgeClaims: false }
const NOW = new Date('2026-10-17T12:00:00Z')

function draftBase(over: Partial<DraftDTO>): DraftDTO {
  return { id: 'd1', kind: 'blog_post', title: 'Titre', status: 'draft', version: 1, createdAt: '', updatedAt: '', conversationId: null, unverifiedClaims: [], baseHash: null, payload: {} as never, previousPayload: null, versions: [], applied: null, ...over }
}
const blogPayload = (over: Partial<BlogPayload> = {}): BlogPayload => ({
  slug: 'nouvel-article', category: 'Dev', readTime: '3 min', date: '2026-10-17',
  fr: { title: article.title, excerpt: article.excerpt, content: article.content },
  en: { title: english.title, excerpt: english.excerpt, content: english.content },
  ...over,
})
const blogDraft = (over: Partial<DraftDTO> = {}, payload: Partial<BlogPayload> = {}) => draftBase({ kind: 'blog_post', payload: blogPayload(payload), ...over })

function patchDraft(target: PatchPayload['target'], after: string, data: PortfolioData, over: Partial<DraftDTO> = {}): DraftDTO {
  const before = (target.section === 'personal' || target.section === 'vision'
    ? (data[target.section] as unknown as Record<string, string>)[target.field]
    : (data[target.section] as unknown as Record<string, string>[]).find((i) => i.slug === target.id || i.id === target.id)![target.field])
  return draftBase({ kind: 'field_patch', title: 'patch', baseHash: fingerprint(before), payload: { target, before, after, afterEn: null, rationale: 'plus clair' } as PatchPayload, ...over })
}

// ── Planning ───────────────────────────────────────────────────────────────────────────────

describe('planApply — new article', () => {
  const data = makePortfolio()

  it('adds the article at the top of the blog, hidden by default, in the editor\'s own shape', () => {
    const r = planApply(blogDraft(), data, OPTS)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const next = r.plan.nextValue as PortfolioData['blog']
    expect(r.plan.key).toBe('blog')
    expect(next).toHaveLength(data.blog.length + 1)
    expect(next[0]).toMatchObject({ slug: 'nouvel-article', title: article.title, published: false, category: 'Dev', date: '2026-10-17', externalUrl: '', author: '', coverImage: '' })
    expect(next.slice(1)).toEqual(data.blog) // the existing posts are untouched
    expect(r.plan.published).toBe(false)
  })

  it('does not change the data it was given', () => {
    const before = JSON.stringify(data)
    planApply(blogDraft(), data, OPTS)
    expect(JSON.stringify(data)).toBe(before)
  })

  it('publishes only when asked', () => {
    const r = planApply(blogDraft(), data, { ...OPTS, publish: true })
    expect(r.ok && (r.plan.nextValue as PortfolioData['blog'])[0].published).toBe(true)
  })

  it('refuses to publish an article with claims to verify until they are acknowledged', () => {
    const d = blogDraft({ unverifiedClaims: ['Durée exacte de la mission'] })
    expect(planApply(d, data, { ...OPTS, publish: true })).toMatchObject({ ok: false, code: 'claims' })
    expect(planApply(d, data, { ...OPTS, publish: true, acknowledgeClaims: true }).ok).toBe(true)
    expect(planApply(d, data, OPTS).ok).toBe(true) // adding it hidden needs no acknowledgement
  })

  it('refuses a slug that is already on the site', () => {
    expect(planApply(blogDraft({}, { slug: 'premier' }), data, OPTS)).toMatchObject({ ok: false, code: 'exists' })
  })

  it('refuses a draft that no longer meets the blog constraints', () => {
    expect(planApply(blogDraft({}, { fr: { title: 'x', excerpt: 'court', content: 'trop court' } }), data, OPTS)).toMatchObject({ ok: false, code: 'invalid' })
    expect(planApply(blogDraft({}, { slug: 'Slug Invalide!' }), data, OPTS)).toMatchObject({ ok: false, code: 'invalid' })
  })

  it('refuses a draft that is already applied or discarded', () => {
    expect(planApply(blogDraft({ status: 'applied' }), data, OPTS)).toMatchObject({ ok: false, code: 'already' })
    expect(planApply(blogDraft({ status: 'discarded' }), data, OPTS)).toMatchObject({ ok: false, code: 'already' })
  })

  it('seeds the reviewed English text under the hashes the public pages look up', () => {
    const r = planApply(blogDraft(), data, OPTS)
    if (!r.ok) throw new Error('plan failed')
    expect(r.plan.seeds).toHaveLength(BLOG_TRANSLATION_FIELD_SETS.length)
    const [page, list] = r.plan.seeds
    // The page translates { title, excerpt, content }; the list and the RSS feed { title, excerpt } — in that order.
    expect(JSON.stringify(page.source)).toBe(JSON.stringify({ title: article.title, excerpt: article.excerpt, content: article.content }))
    expect(JSON.stringify(list.source)).toBe(JSON.stringify({ title: article.title, excerpt: article.excerpt }))
    expect(translationHash(page.source)).toBe(translationHash({ title: article.title, excerpt: article.excerpt, content: article.content }))
    expect(page.key).toBe('blog:nouvel-article')
    expect(page.translated).toEqual({ title: english.title, excerpt: english.excerpt, content: english.content })
    expect(list.translated).toEqual({ title: english.title, excerpt: english.excerpt })
  })

  it('seeds nothing when English is declined or missing', () => {
    expect(planApply(blogDraft(), data, { ...OPTS, includeEnglish: false }).ok && (planApply(blogDraft(), data, { ...OPTS, includeEnglish: false }) as { plan: { seeds: unknown[] } }).plan.seeds).toEqual([])
    const noEn = planApply(blogDraft({}, { en: null }), data, OPTS)
    expect(noEn.ok && noEn.plan.seeds).toEqual([])
  })
})

describe('the public pages still translate blog posts with the seeded field sets', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', 'src', 'app', '[locale]', 'blog', p), 'utf8').replace(/\r\n/g, '\n')

  it('article page, metadata and social card use { title, excerpt, content }', () => {
    expect(read('[slug]/page.tsx')).toMatch(/translateFields\(`blog:\$\{slug\}`, locale, \{ title: post\.title, excerpt: post\.excerpt, content: post\.content \}\)/)
    expect(read('[slug]/page.tsx')).toMatch(/title: post\.title,\n\s*excerpt: post\.excerpt,\n\s*content: post\.content,/)
    expect(read('[slug]/opengraph-image.tsx')).toMatch(/\{ title: post\.title, excerpt: post\.excerpt, content: post\.content \}/)
  })

  it('blog list and RSS feed use { title, excerpt }', () => {
    expect(read('page.tsx')).toMatch(/key: `blog:\$\{p\.slug\}`, fields: \{ title: p\.title, excerpt: p\.excerpt \}/)
    expect(read('rss.xml/route.ts')).toMatch(/key: `blog:\$\{p\.slug\}`, fields: \{ title: p\.title, excerpt: p\.excerpt \}/)
  })
})

describe('planApply — rewriting one field', () => {
  const data = makePortfolio()
  const target = { section: 'projects' as const, id: 'shop', field: 'description' }

  it('changes only that field of that item', () => {
    const r = planApply(patchDraft(target, 'Une description réécrite, plus claire et plus percutante.', data), data, OPTS)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const next = r.plan.nextValue as PortfolioData['projects']
    expect(next[0].description).toBe('Une description réécrite, plus claire et plus percutante.')
    expect({ ...next[0], description: data.projects[0].description }).toEqual(data.projects[0])
    expect(next.slice(1)).toEqual(data.projects.slice(1))
    expect(r.plan.key).toBe('projects')
    expect(r.plan.seeds).toEqual([])
  })

  it.each([
    [{ section: 'blog' as const, id: 'premier', field: 'excerpt' }],
    [{ section: 'experiences' as const, id: 'e1', field: 'description' }],
    [{ section: 'offers' as const, id: 'o1', field: 'description' }],
    [{ section: 'educations' as const, id: 'ed1', field: 'detail' }],
    [{ section: 'vision' as const, id: 'vision', field: 'quote' }],
    [{ section: 'personal' as const, id: 'personal', field: 'bio' }],
  ])('works for %o', (t) => {
    const r = planApply(patchDraft(t, 'Nouveau texte proposé.', data), data, OPTS)
    expect(r.ok).toBe(true)
  })

  it('does not touch anything else of the profile when rewriting the bio', () => {
    const r = planApply(patchDraft({ section: 'personal', id: 'personal', field: 'bio' }, 'Nouvelle bio.', data), data, OPTS)
    if (!r.ok) throw new Error('plan failed')
    const next = r.plan.nextValue as PortfolioData['personal']
    expect({ ...next, bio: data.personal.bio }).toEqual(data.personal) // business details, signature… identical
  })

  it('refuses when the text changed on the site since the draft was written', () => {
    const d = patchDraft(target, 'Réécriture.', data)
    const moved = { ...data, projects: data.projects.map((p) => (p.slug === 'shop' ? { ...p, description: 'Modifiée entre-temps par toi.' } : p)) }
    expect(planApply(d, moved, OPTS)).toMatchObject({ ok: false, code: 'changed' })
  })

  it('refuses when the item has gone, a field is not allowed, or the proposal is empty', () => {
    const d = patchDraft(target, 'Réécriture.', data)
    expect(planApply(d, { ...data, projects: [] }, OPTS)).toMatchObject({ ok: false, code: 'not_found' })
    const forbidden = { ...d, payload: { ...(d.payload as PatchPayload), target: { section: 'personal' as const, id: 'personal', field: 'signatureUrl' } } }
    expect(planApply(forbidden, data, OPTS)).toMatchObject({ ok: false, code: 'invalid' })
    expect(planApply(patchDraft(target, '   ', data), data, OPTS)).toMatchObject({ ok: false, code: 'invalid' })
  })

  it('refuses a patch with no recorded fingerprint', () => {
    expect(planApply(patchDraft(target, 'Réécriture.', data, { baseHash: null }), data, OPTS)).toMatchObject({ ok: false, code: 'changed' })
  })
})

// ── Orchestration ─────────────────────────────────────────────────────────────────────────

function fakeStore(initial = makePortfolio()) {
  const s = { data: initial, version: 'v1', n: 1, journal: [] as AppliedRecord[], undone: [] as string[], applied: [] as string[], unapplied: [] as string[], seeds: [] as unknown[], order: [] as string[] }
  const ports: ApplyPorts & UndoPorts = {
    read: async () => ({ data: structuredClone(s.data), version: s.version }),
    replaceKey: async (key, value, expected) => {
      s.order.push('replace')
      if (expected !== s.version) return 'conflict'
      s.data = { ...s.data, [key]: value }
      s.version = `v${++s.n}`
      return 'ok'
    },
    seedTranslation: async (seed) => { s.order.push('seed'); s.seeds.push(seed) },
    journal: async (r) => { s.order.push('journal'); s.journal.push(r) },
    markApplied: async (id) => { s.order.push('mark'); s.applied.push(id); return true },
    now: () => NOW,
    getApplied: async (id) => [...s.journal].reverse().find((j) => j.draftId === id && !s.undone.includes(id)) ?? null,
    markUndone: async (id) => { s.undone.push(id) },
    markUnapplied: async (id) => { s.unapplied.push(id) },
  }
  return { s, ports }
}

describe('applyDraft', () => {
  it('writes, then seeds the English text, journals and marks the draft — in that order', async () => {
    const { s, ports } = fakeStore()
    const r = await applyDraft(ports, blogDraft(), OPTS)
    expect(r).toMatchObject({ ok: true, published: false, warnings: [] })
    expect(s.order).toEqual(['replace', 'seed', 'seed', 'journal', 'mark'])
    expect(s.data.blog[0].slug).toBe('nouvel-article')
    expect(s.journal[0]).toMatchObject({ draftId: 'd1', key: 'blog', published: false })
  })

  it('writes nothing, seeds nothing and journals nothing when the site changed meanwhile', async () => {
    const { s, ports } = fakeStore()
    const read = ports.read
    ports.read = async () => { const snap = await read(); s.version = 'someone-else-published'; return snap }
    const before = JSON.stringify(s.data)
    expect(await applyDraft(ports, blogDraft(), OPTS)).toMatchObject({ ok: false, code: 'conflict' })
    expect(s.order).toEqual(['replace'])
    expect(JSON.stringify(s.data)).toBe(before)
    expect(s.journal).toEqual([])
  })

  it('reports problems after the write as warnings, not as a failure', async () => {
    const { s, ports } = fakeStore()
    ports.seedTranslation = async () => { throw new Error('db down') }
    ports.journal = async () => { throw new Error('db down') }
    ports.markApplied = async () => false
    const r = await applyDraft(ports, blogDraft(), OPTS)
    expect(r.ok).toBe(true)
    expect(r.ok && r.warnings).toHaveLength(3)
    expect(s.data.blog[0].slug).toBe('nouvel-article') // the change is in
  })

  it('lets exactly one of two simultaneous applications through', async () => {
    const { s, ports } = fakeStore()
    const results = await Promise.all([applyDraft(ports, blogDraft(), OPTS), applyDraft(ports, blogDraft(), OPTS)])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.find((r) => !r.ok)).toMatchObject({ code: 'conflict' })
    expect(s.data.blog.filter((p) => p.slug === 'nouvel-article')).toHaveLength(1)
  })

  it('does not apply twice in a row', async () => {
    const { ports } = fakeStore()
    expect((await applyDraft(ports, blogDraft(), OPTS)).ok).toBe(true)
    // second click on the same (stale) draft record: the slug is now taken
    expect(await applyDraft(ports, blogDraft(), OPTS)).toMatchObject({ ok: false, code: 'exists' })
  })

  it('fails cleanly when the portfolio cannot be read', async () => {
    const { ports } = fakeStore()
    ports.read = async () => null
    expect(await applyDraft(ports, blogDraft(), OPTS)).toMatchObject({ ok: false, code: 'no_portfolio' })
  })
})

describe('undoDraft', () => {
  it('puts the key back exactly as it was', async () => {
    const { s, ports } = fakeStore()
    const original = JSON.stringify(s.data.blog)
    await applyDraft(ports, blogDraft(), OPTS)
    expect(JSON.stringify(s.data.blog)).not.toBe(original)
    expect(await undoDraft(ports, 'd1')).toMatchObject({ ok: true })
    expect(JSON.stringify(s.data.blog)).toBe(original)
    expect(s.undone).toEqual(['d1'])
    expect(s.unapplied).toEqual(['d1'])
  })

  it('also undoes a field rewrite', async () => {
    const { s, ports } = fakeStore()
    const original = JSON.stringify(s.data.projects)
    await applyDraft(ports, patchDraft({ section: 'projects', id: 'shop', field: 'description' }, 'Réécriture.', s.data), OPTS)
    expect(s.data.projects[0].description).toBe('Réécriture.')
    await undoDraft(ports, 'd1')
    expect(JSON.stringify(s.data.projects)).toBe(original)
  })

  it('refuses when that part of the site was edited after the application — and writes nothing', async () => {
    const { s, ports } = fakeStore()
    await applyDraft(ports, blogDraft(), OPTS)
    s.data = { ...s.data, blog: s.data.blog.map((p) => (p.slug === 'premier' ? { ...p, title: 'Retouché à la main' } : p)) }
    s.version = 'v-edited'
    const snapshot = JSON.stringify(s.data)
    expect(await undoDraft(ports, 'd1')).toMatchObject({ ok: false, code: 'changed' })
    expect(JSON.stringify(s.data)).toBe(snapshot)
    expect(s.undone).toEqual([])
  })

  it('has nothing to undo twice or for a draft never applied', async () => {
    const { s, ports } = fakeStore()
    expect(await undoDraft(ports, 'jamais')).toMatchObject({ ok: false, code: 'not_found' })
    await applyDraft(ports, blogDraft(), OPTS)
    await undoDraft(ports, 'd1')
    expect(await undoDraft(ports, 'd1')).toMatchObject({ ok: false, code: 'not_found' })
    expect(s.undone).toEqual(['d1'])
  })
})

// ── The real writers, against a fake collection ────────────────────────────────────────────────

describe('replacePortfolioKey / readPortfolioWithVersion', () => {
  const stored = () => ({ _id: 'main', updatedAt: new Date('2026-10-17T10:00:00.000Z'), blog: [{ slug: 'a' }], personal: { name: 'X' } })

  it('reads the document with its version, merged over the defaults', async () => {
    db.state.doc = stored()
    const r = await readPortfolioWithVersion()
    expect(r?.version).toBe('2026-10-17T10:00:00.000Z')
    expect(r?.data.blog).toEqual([{ slug: 'a' }])
    expect(r?.data.projects).toBeDefined() // default for a key the document lacks
    db.state.doc = null
    expect(await readPortfolioWithVersion()).toBeNull()
  })

  it('writes one key and the version stamp, only if the version still matches', async () => {
    db.state.doc = stored(); db.state.calls.length = 0
    expect(await replacePortfolioKey('blog', [{ slug: 'b' }], '2026-10-17T10:00:00.000Z')).toBe('ok')
    expect(db.state.doc.blog).toEqual([{ slug: 'b' }])
    expect(db.state.doc.personal).toEqual({ name: 'X' }) // other keys untouched
    const set = (db.state.calls[0].update as { $set: Record<string, unknown> }).$set
    expect(Object.keys(set).sort()).toEqual(['blog', 'updatedAt'])
  })

  it('does nothing when the document moved on', async () => {
    db.state.doc = stored()
    expect(await replacePortfolioKey('blog', [{ slug: 'b' }], '2026-10-17T09:00:00.000Z')).toBe('conflict')
    expect(db.state.doc.blog).toEqual([{ slug: 'a' }])
  })

  it('only ever writes the keys a draft can target', async () => {
    db.state.doc = stored(); db.state.calls.length = 0
    for (const key of ['settings', 'availability', 'documents', 'socials', 'testimonials', 'skills', '_id', 'updatedAt', '__proto__', '$set']) {
      await expect(replacePortfolioKey(key, 'x', '2026-10-17T10:00:00.000Z'), key).rejects.toThrow()
    }
    expect(db.state.calls).toHaveLength(0)
  })
})

// ── The assistant cannot reach any of this ──────────────────────────────────────────────────────

describe('only the administrator\'s button can apply a draft', () => {
  const ROOT = join(__dirname, '..', 'src')
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
  const FORBIDDEN = /draft-apply|portfolio-write|assistant-apply|replacePortfolioKey|applyAssistantDraft|undoAssistantDraft|seedTranslation|draftApplyStore/

  it('the assistant\'s code, tools and chat route never reference the apply path', () => {
    const files = [...walk(join(ROOT, 'lib', 'assistant')), join(ROOT, 'app', 'api', 'admin-assistant', 'route.ts'), join(ROOT, 'actions', 'assistant.ts')]
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(FORBIDDEN)
  })

  it('only the apply action and the draft panel call it', () => {
    const users = walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f) && /applyAssistantDraft|undoAssistantDraft/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(ROOT.length + 1).split('\\').join('/')).sort()
    expect(users).toEqual(['actions/assistant-apply.ts', 'components/admin/assistant/DraftsPanel.tsx'])
  })

  it('the apply action starts with the admin check and asks for the confirmation in the page', () => {
    const action = readFileSync(join(ROOT, 'actions', 'assistant-apply.ts'), 'utf8')
    for (const fn of ['applyAssistantDraft', 'undoAssistantDraft']) {
      const body = action.slice(action.indexOf(`export async function ${fn}(`))
      expect(body.indexOf('await requireAdmin()')).toBeGreaterThan(-1)
      expect(body.slice(0, body.indexOf('await requireAdmin()'))).not.toContain('await ')
    }
    expect(readFileSync(join(ROOT, 'components', 'admin', 'assistant', 'DraftsPanel.tsx'), 'utf8')).toMatch(/if \(!confirm\(/)
  })
})
