import type { Skill } from '@/types'

/**
 * Small repairs for text typed in the admin, applied when it is shown (the saved text is not touched): a comma stuck to the
 * next word ("web,mobile", "originalité,différent") gets its space. Numbers ("1,5") and anything else are left alone.
 */
export function tidyText(text: string): string {
  return text.replace(/,(?=[A-Za-zÀ-ÿ])/g, ', ')
}

// Names as they should be written, for the ones seen mistyped in the data (matched on letters and digits only)
const TECH_NAMES: Record<string, string> = {
  boostrap: 'Bootstrap',
  bootstrap: 'Bootstrap',
  rag: 'RAG',
  github: 'GitHub',
  php: 'PHP',
  flutter: 'Flutter',
  powerbi: 'Power BI',
  nextjs: 'Next.js',
  nodejs: 'Node.js',
  mongodb: 'MongoDB',
  postgresql: 'PostgreSQL',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
}

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '')

export function tidyTechName(name: string): string {
  const trimmed = name.trim()
  return TECH_NAMES[key(trimmed)] ?? trimmed
}

/**
 * The skills as they are shown: names spelled right, each name once, and a bare "GitHub" dropped when "Git" or "GitHub
 * Actions" is already listed (three entries for the same thing). Everything else, and the order, stays as in the admin.
 */
export function tidySkills(skills: Skill[]): Skill[] {
  const all = new Set(skills.flatMap((s) => s.items.map((i) => key(i))))
  const hasGitFamily = all.has('git') || all.has('githubactions')
  return skills.map((skill) => {
    const seen = new Set<string>()
    const items = skill.items
      .filter((item) => !(key(item) === 'github' && hasGitFamily))
      .map(tidyTechName)
      .filter((name) => {
        const k = key(name)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    return { ...skill, items }
  })
}
