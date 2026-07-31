import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'
import { defaultProjects } from '@/data/defaultData'
import { translateFields } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import ProjectDetailView from './ProjectDetailView'

async function getProject(slug: string) {
  const portfolio = await fetchPortfolio().catch(() => null)
  const projects = portfolio?.projects ?? defaultProjects
  return projects.find((p) => p.slug === slug) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) return {}

  return {
    title: project.title,
    description: project.description,
    openGraph: {
      type: 'article',
      title: project.title,
      description: project.description,
      images: project.image ? [{ url: project.image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description: project.description,
    },
  }
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug, locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const project = await getProject(slug)

  if (!project) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="section-label mb-4">{t.projects.notFoundLabel}</p>
        <h1 className="section-title mb-8">{t.projects.notFoundTitle}</h1>
        <Link href={`/${locale}/projects`} className="btn-primary">
          {t.projects.backToProjects}
        </Link>
      </div>
    )
  }

  const translated = await translateFields(`project:${slug}`, locale, {
    title: project.title,
    description: project.description,
    longDescription: project.longDescription,
  })

  return (
    <ProjectDetailView
      project={{ ...project, ...translated }}
      locale={locale}
      t={t.projects}
      statusLabel={t.status}
    />
  )
}
