import Link from 'next/link'
import ProjectPicture from '@/components/projects/ProjectPicture'
import Icon from '@/components/ui/Icon'
import type { MoreProjects as MoreProjectsData, ProjectLink } from '@/lib/related-projects'

export interface MoreProjectsLabels {
  previous: string
  next: string
  related: string
}

function Card({ project, locale }: { project: ProjectLink; locale: string }) {
  return (
    <Link href={`/${locale}/projects/${project.slug}`} className="card block overflow-hidden h-full" data-testid="related-project">
      <div className="relative w-full" style={{ aspectRatio: '16 / 9', background: 'var(--surface-hover)' }}>
        {project.image ? (
          <ProjectPicture src={project.image} alt="" loading="lazy" sizes="(min-width: 640px) 33vw, 100vw" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ color: 'var(--text-subtle)' }}>
            <Icon name="layers" size={28} />
          </div>
        )}
      </div>
      <div className="p-5">
        <span className="tag mb-3 inline-block">{project.category}</span>
        <p className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>{project.title}</p>
      </div>
    </Link>
  )
}

function Step({ project, locale, label, direction }: { project: ProjectLink; locale: string; label: string; direction: 'previous' | 'next' }) {
  return (
    <Link
      href={`/${locale}/projects/${project.slug}`}
      rel={direction === 'previous' ? 'prev' : 'next'}
      className={`card p-5 flex items-center gap-4 h-full ${direction === 'next' ? 'flex-row-reverse text-right' : ''}`}
      data-testid={`project-${direction}`}
    >
      <Icon name={direction === 'previous' ? 'arrowLeft' : 'arrowRight'} size={20} style={{ color: 'var(--brand, var(--accent))' }} className="flex-shrink-0" />
      <span className="min-w-0">
        <span className="section-label block mb-1">{label}</span>
        <span className="font-display font-semibold block truncate" style={{ color: 'var(--text)' }}>{project.title}</span>
      </span>
    </Link>
  )
}

// The end of a project page: the previous and the next project, then the ones that look like it.
// Renders nothing when there is nothing to offer.
export default function MoreProjects({ data, locale, labels }: { data: MoreProjectsData; locale: string; labels: MoreProjectsLabels }) {
  const { previous, next, related } = data
  if (!previous && !next && related.length === 0) return null
  return (
    <section className="mt-20 space-y-12" aria-label={labels.related} data-testid="more-projects">
      {related.length > 0 && (
        <div>
          <h2 className="section-label mb-6">{labels.related}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {related.map((p) => <Card key={p.slug} project={p} locale={locale} />)}
          </div>
        </div>
      )}
      {(previous || next) && (
        <nav className={`grid gap-5 ${previous && next ? 'sm:grid-cols-2' : ''}`} aria-label={`${labels.previous} / ${labels.next}`}>
          {previous && <Step project={previous} locale={locale} label={labels.previous} direction="previous" />}
          {next && <Step project={next} locale={locale} label={labels.next} direction="next" />}
        </nav>
      )}
    </section>
  )
}
