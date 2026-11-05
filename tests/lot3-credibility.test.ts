import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { deliveredFirst, safeLinkedinUrl } from '@/lib/testimonials'
import { tidySkills, tidyText, tidyTechName } from '@/lib/text-tidy'
import { TEASER_TEXT } from '@/lib/chat-services'
import { getDictionary } from '@/lib/i18n/dictionaries'

const root = join(__dirname, '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8')

describe('testimonials', () => {
  it('put the ones about a delivered job (linked to a project) first, the others keep their order', () => {
    const list = [{ id: 'a' }, { id: 'b', projectSlug: 'tswe' }, { id: 'c' }, { id: 'd', projectSlug: 'fpbg' }]
    expect(deliveredFirst(list).map((t) => t.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(deliveredFirst([])).toEqual([])
  })

  it('link to LinkedIn only for a real https linkedin.com address', () => {
    expect(safeLinkedinUrl('https://www.linkedin.com/in/someone')).toBe('https://www.linkedin.com/in/someone')
    expect(safeLinkedinUrl('https://linkedin.com/in/x')).toBeTruthy()
    for (const bad of ['http://www.linkedin.com/in/x', 'https://evil.com/linkedin.com', 'https://linkedin.com.evil.com/in/x', 'javascript:alert(1)', 'linkedin.com/in/x', '', undefined]) {
      expect(safeLinkedinUrl(bad), String(bad)).toBeNull()
    }
  })

  it('no longer show the numeric rating on the public card, and show photo (optional), company, project and LinkedIn', () => {
    const card = read('src', 'components', 'sections', 'TestimonialsMarquee.tsx')
    expect(card).not.toContain('StarRating')
    expect(card).toContain('tm.avatar')
    expect(card).toContain('tm.company')
    expect(card).toContain('safeLinkedinUrl(tm.linkedinUrl)')
    expect(card).toContain('rel="noopener noreferrer"')
    expect(card).toContain('tm.verifiedText')
  })

  it('have a LinkedIn field in the admin and in the type, and the home orders them with delivered jobs first', () => {
    expect(read('src', 'types', 'index.ts')).toContain('linkedinUrl?: string')
    expect(read('src', 'app', 'admin', 'testimonials', 'page.tsx')).toContain('form.linkedinUrl')
    expect(read('src', 'app', '[locale]', 'page.tsx')).toContain('deliveredFirst(portfolio?.testimonials ?? defaultTestimonials)')
  })

  it('have the project and LinkedIn labels in both languages, with their placeholders', () => {
    for (const l of ['fr', 'en'] as const) {
      const h = getDictionary(l).home
      expect(h.testimonialsProject).toContain('{project}')
      expect(h.testimonialsLinkedin).toContain('{name}')
    }
  })
})

describe('the name is written one way: Nawaf Nemrod SALAMI', () => {
  it('everywhere in the code (titles, meta, hero, footer, OG images, structured data)', () => {
    const bad: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(name) && /Nemrod Salami|NEMROD SALAMI/.test(readFileSync(p, 'utf8'))) bad.push(p.replace(root, ''))
      }
    }
    walk(join(root, 'src'))
    expect(bad).toEqual([])
    expect(read('src', 'lib', 'seo.ts')).toContain("SITE_NAME = 'Nawaf Nemrod SALAMI'")
    expect(read('src', 'app', 'layout.tsx')).toContain("template: '%s | Nawaf Nemrod SALAMI'")
    expect(read('src', 'data', 'defaultData.ts')).toContain("name: 'Nawaf Nemrod SALAMI'")
  })
})

describe('repairs applied when the admin text is shown', () => {
  it('put the missing space after a comma stuck to a word, and leave numbers alone', () => {
    expect(tidyText('solutions web,mobile & IA')).toBe('solutions web, mobile & IA')
    expect(tidyText('originalité,différent')).toBe('originalité, différent')
    expect(tidyText('1,5 an et 2,000 €')).toBe('1,5 an et 2,000 €')
    expect(tidyText('déjà, bien espacé')).toBe('déjà, bien espacé')
  })

  it('spell the technologies right', () => {
    expect(tidyTechName('Boostrap')).toBe('Bootstrap')
    expect(tidyTechName('R.A.G')).toBe('RAG')
    expect(tidyTechName('Github')).toBe('GitHub')
    expect(tidyTechName('php')).toBe('PHP')
    expect(tidyTechName('Power Bi')).toBe('Power BI')
    expect(tidyTechName('Laravel')).toBe('Laravel')
  })

  it('list GitHub, Git and GitHub Actions without the triple', () => {
    const skills = [
      { id: '1', category: 'DevOps', items: ['Docker', 'GitHub Actions'] },
      { id: '2', category: 'Outils', items: ['Git', 'Github', 'Postman', 'postman'] },
    ]
    const out = tidySkills(skills)
    expect(out[0].items).toEqual(['Docker', 'GitHub Actions'])
    expect(out[1].items).toEqual(['Git', 'Postman'])
    // a lone GitHub stays: nothing else says it
    expect(tidySkills([{ id: '1', category: 'x', items: ['Github'] }])[0].items).toEqual(['GitHub'])
  })

  it('are used by the home and experience pages', () => {
    expect(read('src', 'app', '[locale]', 'page.tsx')).toContain('tidySkills(portfolio?.skills ?? defaultSkills)')
    expect(read('src', 'app', '[locale]', 'resume', 'page.tsx')).toContain('tidySkills(portfolio?.skills ?? defaultSkills)')
  })
})

describe('the assistant is easy to find, without a pop-up', () => {
  it('has three suggested questions in each language, including price and delivery time', () => {
    for (const l of ['fr', 'en'] as const) expect(TEASER_TEXT[l].questions.length).toBe(3)
    expect(TEASER_TEXT.fr.questions[0]).toBe('Combien coûte un site vitrine ?')
    expect(TEASER_TEXT.fr.questions[1]).toBe('Quels sont les délais ?')
  })

  it('sends the tapped question to the assistant, and stays a small dismissible note (once per session, not on signing pages)', () => {
    const loader = read('src', 'components', 'chat', 'ChatWidgetLoader.tsx')
    expect(loader).toContain('openChatWithMessage(q)')
    expect(loader).toContain('sessionStorage')
    expect(loader).toContain('aria-label={t.close}')
    expect(loader).toContain('role="status"')
    expect(loader).not.toContain('role="dialog"')
  })
})
