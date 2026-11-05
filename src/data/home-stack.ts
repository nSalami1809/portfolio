import type { IconName } from '@/components/ui/Icon'

/**
 * The stack shown on the home page: twelve key technologies in four groups. The full list (every skill saved in the
 * admin) stays on the Experience page. To change what the home shows, change this file: a name with a logo in
 * lib/tech-logos.ts gets it; otherwise `icon` (a generic icon of the site) is used, or nothing.
 */
export interface StackGroup {
  id: string
  icon: IconName
  label: { fr: string; en: string }
  items: { name: string | { fr: string; en: string }; icon?: IconName }[]
}

export const HOME_STACK: StackGroup[] = [
  {
    id: 'frontend',
    icon: 'layout',
    label: { fr: 'Frontend', en: 'Frontend' },
    items: [{ name: 'React' }, { name: 'Next.js' }, { name: 'TypeScript' }, { name: 'Tailwind CSS' }],
  },
  {
    id: 'backend',
    icon: 'server',
    label: { fr: 'Backend', en: 'Backend' },
    items: [{ name: 'Node.js' }, { name: 'PostgreSQL' }, { name: 'MongoDB' }],
  },
  {
    id: 'devops',
    icon: 'cloud',
    label: { fr: 'DevOps', en: 'DevOps' },
    items: [{ name: 'Docker' }, { name: 'GitHub Actions' }, { name: 'Terraform' }],
  },
  {
    id: 'ai',
    icon: 'ai',
    label: { fr: 'IA', en: 'AI' },
    items: [
      { name: 'RAG', icon: 'database' },
      { name: { fr: 'Agents IA', en: 'AI agents' }, icon: 'ai' },
    ],
  },
]
