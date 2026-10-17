import { describe, it, expect } from 'vitest'
import { auditPortfolio, mentions, normalize } from '@/lib/assistant/audit'
import { blogDetail, blogSummary, businessOverview, capResult, clip, profileView, projectDetail } from '@/lib/assistant/views'
import type { BusinessStats } from '@/lib/business-stats'
import { makePortfolio } from './assistant-data'

const NOW = new Date('2026-10-17T12:00:00Z')

describe('skill matching', () => {
  it('matches whole words, accent- and case-insensitively', () => {
    expect(mentions(normalize('Développé avec React et Node.js'), 'react')).toBe(true)
    expect(mentions(normalize('Développé avec React et Node.js'), 'Node.js')).toBe(true)
    expect(mentions(normalize('Réalisé en Prog. Fonctionnelle'), 'Programmation')).toBe(false)
  })

  it("does not confuse a short name with a longer one", () => {
    expect(mentions(normalize('projet en c# et java'), 'C')).toBe(false)
    expect(mentions(normalize('projet en c++ moderne'), 'C')).toBe(false)
    expect(mentions(normalize('langages : c, go'), 'C')).toBe(true)
    expect(mentions(normalize('typescript partout'), 'script')).toBe(false)
  })
})

describe('auditPortfolio', () => {
  const audit = auditPortfolio(makePortfolio(), { premier: 120 }, NOW)
  const messages = audit.issues.map((i) => `${i.area}|${i.item}|${i.message}`)
  const has = (re: RegExp) => messages.some((m) => re.test(m))

  it('counts the content', () => {
    expect(audit.counts).toMatchObject({ projects: 3, blogPublished: 1, blogDrafts: 1, experiences: 2, offers: 2, skills: 6, testimonials: 1 })
  })

  it('flags a finished project without case study as high severity', () => {
    const issue = audit.issues.find((i) => i.item === 'CRM interne' && /étude de cas/.test(i.message))
    expect(issue?.severity).toBe('high')
  })

  it('flags thin projects, experiences and offers', () => {
    expect(has(/CRM interne\|Description courte/)).toBe(true)
    expect(has(/CRM interne\|Aucune technologie/)).toBe(true)
    expect(has(/Studio X\|Description courte/)).toBe(true)
    expect(has(/Conseil\|Pas de fourchette de prix/)).toBe(true)
  })

  it('flags stale unpublished drafts and short extracts', () => {
    expect(has(/Vieux brouillon\|Brouillon vieux de/)).toBe(true)
    expect(has(/Vieux brouillon\|Extrait absent ou trop court/)).toBe(true)
  })

  it('finds skills that appear nowhere in the portfolio content', () => {
    const names = audit.underrepresentedSkills.map((s) => s.skill)
    expect(names).toContain('Vue')
    expect(names).toContain('Python')
    expect(names).toContain('Git')
    expect(names).not.toContain('React')
  })

  it('computes coverage per skill from projects, experiences and articles', () => {
    const react = audit.skillCoverage.find((r) => r.skill === 'React')!
    expect(react.projects).toBeGreaterThanOrEqual(1)
    expect(react.experiences).toBe(1)
    expect(react.articles).toBeGreaterThanOrEqual(1)
    expect(react.total).toBe(react.projects + react.experiences + react.articles)
  })

  it('finds technologies used but not listed as skills', () => {
    const tags = audit.technologiesNotListed.map((t) => t.tag)
    expect(tags).toContain('Flutter')
    expect(tags).toContain('Docker')
    expect(tags).toContain('PostgreSQL')
    expect(tags).not.toContain('React')
  })

  it('is deterministic and sorted most severe first', () => {
    expect(auditPortfolio(makePortfolio(), { premier: 120 }, NOW)).toEqual(audit)
    const order = { high: 0, medium: 1, low: 2 }
    const sev = audit.issues.map((i) => order[i.severity])
    expect(sev).toEqual([...sev].sort((a, b) => a - b))
  })

  it('does not invent findings for an empty portfolio', () => {
    const empty = { ...makePortfolio(), projects: [], blog: [], experiences: [], skills: [], offers: [], testimonials: [] }
    const a = auditPortfolio(empty, {}, NOW)
    expect(a.skillCoverage).toEqual([])
    expect(a.underrepresentedSkills).toEqual([])
    expect(a.counts.projects).toBe(0)
  })
})

describe('what the model is allowed to see', () => {
  const data = makePortfolio()

  it('never exposes billing details, signature or legal identity', () => {
    const everything = JSON.stringify([
      profileView(data.personal, data.socials),
      data.projects.map(projectDetail),
      data.blog.map((b) => blogSummary(b)),
      data.blog.map((b) => blogDetail(b)),
    ])
    for (const secret of ['SECRET-PAYMENT-COORDINATES', 'SECRET-NIF', 'SECRET-ADDRESS', 'SECRET-SIGNATURE', 'signatureUrl', 'paymentDetails']) {
      expect(everything).not.toContain(secret)
    }
  })

  it('keeps only linked social networks', () => {
    expect(profileView(data.personal, data.socials).socials).toEqual({ github: 'https://github.com/alex' })
  })

  it('aggregates business figures without client names', () => {
    const stats = {
      pipeline: { pending: { count: 1, amount: 10 }, expired: { count: 0, amount: 0 }, signed: { count: 2, amount: 50 }, declined: { count: 0, amount: 0 } },
      conversionRate: 0.5, avgDaysToSign: 3,
      cash: { billed: 1, collected: 1, outstanding: 0, overdue: 0, overdueCount: 0 },
      months: [],
      inProgress: [{ numero: 'DEV-1', clientNom: 'CLIENT-SECRET-NAME', totalTTC: 1, dueAt: '2026-11-01', late: true }],
      awaitingRecette: [],
      todo: [{ kind: 'issue_deposit', numero: 'DEV-1', clientNom: 'CLIENT-SECRET-NAME' }, { kind: 'issue_deposit', numero: 'DEV-2', clientNom: 'AUTRE' }],
    } as unknown as BusinessStats
    const out = JSON.stringify(businessOverview(stats))
    expect(out).not.toContain('CLIENT-SECRET-NAME')
    expect(out).not.toContain('AUTRE')
    expect(businessOverview(stats).todoByKind).toEqual({ issue_deposit: 2 })
    expect(businessOverview(stats).inProgress).toEqual({ count: 1, late: 1 })
  })

  it('clips long text and caps oversized tool results', () => {
    expect(clip('a'.repeat(50), 10)).toBe('aaaaaaaaaa…')
    const big = Array.from({ length: 200 }, (_, i) => ({ i, text: 'x'.repeat(100) }))
    const capped = capResult(big, 2000) as { truncated: boolean; total: number; items: unknown[] }
    expect(capped.truncated).toBe(true)
    expect(capped.total).toBe(200)
    expect(JSON.stringify(capped).length).toBeLessThanOrEqual(2000)
    expect(capResult({ small: true }, 2000)).toEqual({ small: true })
    const bigObject = capResult({ blob: 'y'.repeat(5000) }, 1000) as { truncated: boolean; preview: string }
    expect(bigObject.truncated).toBe(true)
    expect(JSON.stringify(bigObject).length).toBeLessThanOrEqual(1100)
  })

  it('truncates a long article body and says so', () => {
    const d = blogDetail({ ...data.blog[0], content: 'z'.repeat(20_000) }, {}, 3000)
    expect(d.contentTruncated).toBe(true)
    expect(d.content.length).toBeLessThanOrEqual(3001)
  })
})
