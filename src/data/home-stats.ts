import type { IconName } from '@/components/ui/Icon'

/**
 * The four figures of the About block on the home page. Each one is a fact that can be checked, and it is written here,
 * in one place, in both languages: to change a figure, change this file (nothing else on the page holds a number).
 * A value made of a number and a sign ("3+", "10+") counts up when it scrolls into view; any other value is shown as is.
 */
export interface HomeStat {
  icon: IconName
  value: { fr: string; en: string }
  label: { fr: string; en: string }
}

export const HOME_STATS: HomeStat[] = [
  {
    icon: 'calendar',
    value: { fr: '3+', en: '3+' },
    label: { fr: 'Ans d’expérience', en: 'Years of experience' },
  },
  {
    icon: 'projectDone',
    value: { fr: '10+', en: '10+' },
    label: { fr: 'Projets livrés', en: 'Projects delivered' },
  },
  {
    icon: 'clock',
    value: { fr: '1 mois', en: '1 month' },
    label: { fr: 'Délai moyen de livraison', en: 'Average delivery time' },
  },
  {
    icon: 'shield',
    value: { fr: 'Offert', en: 'Free' },
    label: { fr: 'Corrections garanties le 1er mois après livraison', en: 'Fixes guaranteed in the first month after delivery' },
  },
]
