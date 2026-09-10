import type { Metadata } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'
import { translateFields } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { defaultProjects } from '@/data/defaultData'
import ProjectsView from './ProjectsView'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  return { title: t.projects.title, description: t.projects.subtitle }
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolio().catch(() => null)
  const projects = portfolio?.projects ?? defaultProjects

  const translatedProjects = await Promise.all(
    projects.map(async (p) => {
      const fields = await translateFields(`project:${p.slug}`, locale, { title: p.title, description: p.description })
      return { ...p, title: fields.title, description: fields.description }
    }),
  )

  return <ProjectsView projects={translatedProjects} locale={locale} t={t.projects} statusLabel={t.status} />
}
