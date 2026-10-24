import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { moreProjects, neighbours, relatedProjects, type ProjectLink } from '@/lib/related-projects'
import MoreProjects from '@/components/projects/MoreProjects'
import { getDictionary } from '@/lib/i18n/dictionaries'

const p = (slug: string, category: string, tags: string[], image?: string): ProjectLink => ({ slug, title: slug.toUpperCase(), category, tags, image })
const LIST = [
  p('a', 'Web', ['React', 'Node.js']),
  p('b', 'Web', ['Next.js', 'React', 'MongoDB']),
  p('c', 'IA / ML', ['Python']),
  p('d', 'Backend', ['node.js', 'Docker']),
  p('e', 'Web', []),
]

describe('previous and next project', () => {
  it('follow the order of the list and loop at both ends', () => {
    expect(neighbours(LIST, 'b')).toEqual({ previous: LIST[0], next: LIST[2] })
    expect(neighbours(LIST, 'a').previous?.slug).toBe('e')
    expect(neighbours(LIST, 'e').next?.slug).toBe('a')
  })

  it('offer a single neighbour when there are only two projects, and none for one project', () => {
    expect(neighbours(LIST.slice(0, 2), 'a')).toEqual({ previous: null, next: LIST[1] })
    expect(neighbours(LIST.slice(0, 1), 'a')).toEqual({ previous: null, next: null })
    expect(neighbours([], 'a')).toEqual({ previous: null, next: null })
  })

  it('give nothing for a project that is not in the list', () => {
    expect(neighbours(LIST, 'zzz')).toEqual({ previous: null, next: null })
  })
})

describe('similar projects', () => {
  it('rank by technologies in common, then by category, then by the list order', () => {
    // a: React + Node.js. b shares React (2) + same category Web (1) = 3; d shares node.js (2, case-insensitive) = 2; e is in Web (1)
    expect(relatedProjects(LIST[0], LIST).map((x) => x.slug)).toEqual(['b', 'd', 'e'])
  })

  it('never offer the project itself, nor one with nothing in common', () => {
    const out = relatedProjects(LIST[2], LIST)
    expect(out.map((x) => x.slug)).toEqual([])
    expect(relatedProjects(LIST[0], LIST).some((x) => x.slug === 'a')).toBe(false)
  })

  it('offer at most three, and count a shared technology once', () => {
    const many = [p('x', 'Web', ['a']), ...Array.from({ length: 6 }, (_, i) => p(`y${i}`, 'Web', ['a', 'A', ' a ']))]
    const out = relatedProjects(many[0], many)
    expect(out).toHaveLength(3)
    expect(out.map((x) => x.slug)).toEqual(['y0', 'y1', 'y2'])
  })

  it('give the previous, the next and the similar ones together', () => {
    const more = moreProjects(LIST[1], LIST)
    expect(more.previous?.slug).toBe('a')
    expect(more.next?.slug).toBe('c')
    expect(more.related.map((x) => x.slug)).toEqual(['a', 'e'])
  })
})

vi.mock('next/image', () => ({ default: (props: { src: string; alt: string }) => h('img', { src: props.src, alt: props.alt }) }))

describe('the end of a project page', () => {
  const labels = { previous: 'Projet précédent', next: 'Projet suivant', related: 'Projets similaires' }
  const html = (data: ReturnType<typeof moreProjects>) => renderToStaticMarkup(h(MoreProjects, { data, locale: 'fr', labels }))

  it('shows the similar projects as cards that link to their page, and the two neighbours', () => {
    const out = html(moreProjects(LIST[1], LIST))
    expect(out.match(/data-testid="related-project"/g)).toHaveLength(2)
    expect(out).toContain('href="/fr/projects/a"')
    expect(out).toContain('data-testid="project-previous"')
    expect(out).toContain('data-testid="project-next"')
    expect(out).toContain('rel="prev"')
    expect(out).toContain('rel="next"')
    expect(out).toContain('Projets similaires')
  })

  it('shows only what exists: no similar section without similar projects', () => {
    const out = html({ previous: LIST[0], next: LIST[1], related: [] })
    expect(out).not.toContain('related-project')
    expect(out).not.toContain('Projets similaires</h2>')
    expect(out).toContain('project-previous')
  })

  it('shows nothing at all for a lone project', () => {
    expect(html({ previous: null, next: null, related: [] })).toBe('')
  })

  it('exists in both languages', () => {
    for (const locale of ['fr', 'en'] as const) {
      const t = getDictionary(locale).projects
      expect(t.previousProject).toBeTruthy()
      expect(t.nextProject).toBeTruthy()
      expect(t.relatedProjects).toBeTruthy()
    }
    expect(getDictionary('fr').projects.nextProject).not.toBe(getDictionary('en').projects.nextProject)
  })
})
