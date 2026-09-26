import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultProjects } from '@/data/defaultData'
import { translateFields } from '@/lib/translate'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { ogCard, OG_SIZE } from '@/lib/og-card'

export const alt = 'Projet — Nawaf Nemrod Salami'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 3600

// Card shown when a project is shared (unless the project has its own image,
// which then takes precedence — see the page's metadata).
export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const portfolio = await fetchPortfolioSafe('projects/og')
  const project = (portfolio?.projects ?? defaultProjects).find((p) => p.slug === slug)

  if (!project) return ogCard({ kicker: locale === 'en' ? 'Project' : 'Projet', title: 'Nawaf Nemrod Salami' })

  // Same fields as the page itself, so the cached translation is reused.
  const t = await translateFields(`project:${slug}`, locale, {
    title: project.title,
    description: project.description,
    longDescription: project.longDescription,
    caseStudyContext: project.caseStudyContext ?? '',
    caseStudySolution: project.caseStudySolution ?? '',
    caseStudyResults: project.caseStudyResults ?? '',
  })
  return ogCard({
    kicker: `${locale === 'en' ? 'Project' : 'Projet'} · ${project.category}`,
    title: t.title,
    subtitle: t.description,
    tags: project.tags,
  })
}
