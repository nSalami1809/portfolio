import type { Metadata } from 'next'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultProjects } from '@/data/defaultData'
import { translateFields } from '@/lib/translate'
import { jsonLdScript } from '@/lib/json-ld'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import ProjectDetailView from './ProjectDetailView'
import NotFoundMessage from '@/components/NotFoundMessage'
import { LOCALES } from '@/lib/i18n/locale'

// Regenerate at most once every 30s, matching every sibling route;
// invalidated instantly on admin publish via updateTag('portfolio').
export const revalidate = 30

// Without this, both locales of every project rendered on demand — and the EN
// render blocks inside TTFB on a Gemini translation of the whole case study
// the first time it is requested. Prerendering at build time moves that cost
// off the visitor's request entirely.
export async function generateStaticParams() {
  const portfolio = await fetchPortfolioSafe('projects/[slug]/generateStaticParams')
  const projects = portfolio?.projects ?? defaultProjects
  return LOCALES.flatMap((locale) => projects.map((p) => ({ locale, slug: p.slug })))
}

async function getProject(slug: string) {
  const portfolio = await fetchPortfolioSafe('projects/[slug]/page')
  const projects = portfolio?.projects ?? defaultProjects
  return projects.find((p) => p.slug === slug) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) return { robots: { index: false, follow: false } }

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
    return <NotFoundMessage locale={locale} t={t.notFound} />
  }

  const translated = await translateFields(`project:${slug}`, locale, {
    title: project.title,
    description: project.description,
    longDescription: project.longDescription,
    caseStudyContext: project.caseStudyContext ?? '',
    caseStudySolution: project.caseStudySolution ?? '',
    caseStudyResults: project.caseStudyResults ?? '',
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: translated.title,
    description: translated.description,
    image: project.image || undefined,
    datePublished: project.year,
    author: { '@type': 'Person', name: 'Nawaf Nemrod Salami' },
    keywords: project.tags.length ? project.tags.join(', ') : undefined,
    url: project.liveUrl || `${siteUrl}/${locale}/projects/${slug}`,
    mainEntityOfPage: `${siteUrl}/${locale}/projects/${slug}`,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <ProjectDetailView
        project={{ ...project, ...translated }}
        locale={locale}
        t={t.projects}
        statusLabel={t.status}
      />
    </>
  )
}
