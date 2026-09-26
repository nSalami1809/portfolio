import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { translateFieldsBatch } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { defaultProjects } from '@/data/defaultData'
import ProjectsView from './ProjectsView'
import { pageMeta } from '@/lib/seo'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  return pageMeta({ locale, path: '/projects', title: t.projects.title, description: t.projects.subtitle })
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolioSafe('projects/page')
  const projects = portfolio?.projects ?? defaultProjects

  // One cache round trip for the whole list, not one per project.
  const fields = await translateFieldsBatch(
    locale,
    projects.map((p) => ({ key: `project:${p.slug}`, fields: { title: p.title, description: p.description } })),
  )
  // Only what a grid card shows — long descriptions and case studies stay on the project's own page.
  const translatedProjects = projects.map((p, i) => ({
    slug: p.slug,
    title: fields[i].title,
    description: fields[i].description,
    category: p.category,
    tags: p.tags,
    status: p.status,
    image: p.image,
  }))

  return <ProjectsView projects={translatedProjects} locale={locale} t={t.projects} statusLabel={t.status} />
}
