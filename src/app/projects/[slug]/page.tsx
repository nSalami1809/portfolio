import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'
import { defaultProjects } from '@/data/defaultData'
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

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = await getProject(slug)

  if (!project) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="section-label mb-4">Introuvable</p>
        <h1 className="section-title mb-8">Projet non trouvé</h1>
        <Link href="/projects" className="btn-primary">
          ← Retour aux projets
        </Link>
      </div>
    )
  }

  return <ProjectDetailView project={project} />
}
