import Link from 'next/link'
import FadeIn from '@/components/animations/FadeIn'
import ProjectPicture from '@/components/projects/ProjectPicture'
import Icon from '@/components/ui/Icon'
import { translateFieldsBatch } from '@/lib/translate'
import { pickFeaturedProjects } from '@/lib/featured-projects'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/locale'
import type { Project } from '@/types'

/** Reserves the section's height while its texts are translated, so nothing moves when they arrive. */
export function FeaturedProjectsSkeleton() {
  return <div aria-hidden="true" className="animate-pulse" style={{ height: 640, background: 'var(--surface)', opacity: 0.4 }} />
}

/**
 * Three projects from the /projects list, each with what a client wants to know: the picture, what the need was, the
 * stack, the result when there is one, and the way to the whole case study. Nothing is written here: every text is the
 * project's own, from the admin.
 */
export default async function FeaturedProjects({ projects, locale, t }: { projects: Project[]; locale: Locale; t: Dictionary['home'] }) {
  const picked = pickFeaturedProjects(projects, 3)
  if (picked.length === 0) return null

  // Same fields (so the same cache) as the project's own page: no new translation for a project already read in English
  const fields = await translateFieldsBatch(
    locale,
    picked.map((p) => ({
      key: `project:${p.slug}`,
      fields: {
        title: p.title,
        description: p.description,
        longDescription: p.longDescription,
        caseStudyContext: p.caseStudyContext ?? '',
        caseStudySolution: p.caseStudySolution ?? '',
        caseStudyResults: p.caseStudyResults ?? '',
      },
    })),
  )

  return (
    <section id="projets-phares" aria-labelledby="featured-title" className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn className="mb-12">
          <p className="section-label mb-3">{t.featuredLabel}</p>
          <h2 id="featured-title" className="section-title">{t.featuredTitle}</h2>
        </FadeIn>

        <ul className="grid lg:grid-cols-3 gap-4 list-none p-0 m-0 mb-10">
          {picked.map((p, i) => {
            const f = fields[i]
            const need = f.caseStudyContext.trim() || f.description
            const result = f.caseStudyResults.trim()
            const hasCase = Boolean(f.caseStudyContext.trim() || result || f.caseStudySolution.trim())
            return (
              <li key={p.slug}>
                <article className="card p-6 h-full flex flex-col">
                    {p.image ? (
                      <div className="relative w-full aspect-video mb-5 overflow-hidden" style={{ background: 'var(--surface-hover)' }}>
                        <ProjectPicture src={p.image} alt={f.title} loading="lazy" sizes="(min-width: 1024px) 33vw, 100vw" />
                      </div>
                    ) : null}

                    <h3 className="font-display font-semibold text-xl mb-4" style={{ color: 'var(--text)' }}>{f.title}</h3>

                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{t.featuredNeed}</p>
                    <p className="text-sm leading-relaxed mb-4 line-clamp-4" style={{ color: 'var(--text-muted)' }}>{need}</p>

                    {result && (
                      <>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{t.featuredResult}</p>
                        <p className="text-sm leading-relaxed mb-4 line-clamp-3" style={{ color: 'var(--text-muted)' }}>{result}</p>
                      </>
                    )}

                    <div className="flex flex-wrap gap-2 mb-6 mt-auto">
                      {p.tags.slice(0, 5).map((tag) => <span key={tag} className="tag">{tag}</span>)}
                    </div>

                    <Link
                      href={`/${locale}/projects/${p.slug}`}
                      className="inline-flex items-center gap-2 text-sm font-medium hover:underline underline-offset-4"
                      style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}
                    >
                      {hasCase ? t.featuredCase : t.featuredProject}
                      <span className="sr-only"> — {f.title}</span>
                      <Icon name="arrowRight" size={14} />
                    </Link>
                  </article>
              </li>
            )
          })}
        </ul>

        <Link href={`/${locale}/projects`} className="btn-secondary">
          {t.featuredAll}
          <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </section>
  )
}
