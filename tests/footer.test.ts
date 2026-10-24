import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Footer from '@/components/layout/Footer'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { defaultPersonalInfo } from '@/data/defaultData'

const render = (locale: 'fr' | 'en') => {
  const t = getDictionary(locale)
  return renderToStaticMarkup(h(Footer, {
    personal: { ...defaultPersonalInfo, whatsapp: '+241 07 12 34 56', email: 'a@b.test' },
    socials: { github: 'https://github.com/x', linkedin: '', instagram: '' } as never,
    locale, t: { nav: t.nav, footer: t.footer }, role: 'Développeur',
  }))
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
const column = (html: string, testId: string) => new RegExp(`data-testid="${testId}"[\\s\\S]*?</nav>`).exec(html)?.[0] ?? ''

describe('the footer\'s "Travailler avec moi" column', () => {
  const out = render('fr')
  const work = column(out, 'footer-work')

  it('is a column of its own, whose heading leads to the offers', () => {
    expect(work).toContain('Travailler avec moi')
    expect(work).toMatch(/<a [^>]*href="\/fr\/offres"[^>]*>Travailler avec moi<\/a>/)
  })

  it('says what it is for, in one line', () => {
    expect(work).toContain('Du premier échange à la livraison.')
  })

  it('lists everything the menu entry holds, in the order of a project', () => {
    expect(hrefs(work)).toEqual([
      '/fr/offres', // the heading
      '/fr/offres', '/fr/methode', '/fr/guides', '/fr/devis', '/fr/calendrier', '/fr/suivi', '/fr/contact',
    ])
    for (const label of ['Offres', 'Ma méthode', 'Guides pratiques', 'Devis instantané', 'Prendre rendez-vous', 'Suivre mon dossier', 'Contact']) expect(work).toContain(label)
  })

  it('gives every link its own icon', () => {
    const links = work.match(/<a [^>]*>[\s\S]*?<\/a>/g) ?? []
    const withIcon = links.filter((l) => l.includes('<svg'))
    expect(withIcon).toHaveLength(7)
    expect(new Set(withIcon.map((l) => /<svg[\s\S]*?<\/svg>/.exec(l)?.[0])).size).toBe(7)
  })

  it('offers the same pages as the menu\'s drop-down (the terms of sale stay in the bottom bar)', () => {
    const nav = readFileSync(join(__dirname, '..', 'src', 'components', 'layout', 'Navbar.tsx'), 'utf8')
    const menuPages = [...nav.matchAll(/\{ href: `\/\$\{locale\}(\/[a-z-]+)`, label: t\.(?:work\w+|contact), icon:/g)].map((m) => `/fr${m[1]}`)
    expect(menuPages.length).toBeGreaterThanOrEqual(7)
    for (const page of menuPages) {
      if (page === '/fr/cgv') expect(out).toContain('href="/fr/cgv"')
      else expect(hrefs(work), page).toContain(page)
    }
  })
})

describe('the footer\'s portfolio column', () => {
  it('lists the portfolio\'s pages, with the two that were missing: vision and the lab', () => {
    const col = column(render('fr'), 'footer-portfolio')
    expect(hrefs(col)).toEqual(['/fr', '/fr/resume', '/fr/vision', '/fr/projects', '/fr/blog', '/fr/documents', '/fr/playground'])
  })
})

describe('the footer as a whole', () => {
  it('keeps its contact column and its legal bar', () => {
    const out = render('fr')
    expect(out).toContain('mailto:a@b.test')
    expect(out).toContain('https://wa.me/24107123456')
    for (const page of ['/fr/mentions-legales', '/fr/confidentialite', '/fr/cgv']) expect(hrefs(out)).toContain(page)
  })

  it('is written in English too, with English links', () => {
    const out = render('en')
    const work = column(out, 'footer-work')
    expect(work).toContain('From first contact to delivery.')
    expect(work).toContain('Practical guides')
    expect(hrefs(work)).toContain('/en/guides')
    expect(hrefs(work).every((h) => h.startsWith('/en/'))).toBe(true)
  })

  it('names its columns for assistive technology', () => {
    const out = render('fr')
    expect(out).toContain('aria-label="Le portfolio"')
    expect(out).toContain('aria-label="Travailler avec moi"')
  })
})
