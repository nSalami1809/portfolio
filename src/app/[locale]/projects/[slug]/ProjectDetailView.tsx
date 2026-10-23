'use client'

import Link from 'next/link'
import ProjectPicture from '@/components/projects/ProjectPicture'
import type { Project } from '@/types'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import FadeIn from '@/components/animations/FadeIn'
import ShareButton from '@/components/ui/ShareButton'
import ProjectMedia from '@/components/projects/ProjectMedia'
import { mobileImages, projectImages } from '@/lib/project-gallery'
import Icon from '@/components/ui/Icon'

const statusColor: Record<string, string> = {
  completed: '#008000',
  'in-progress': '#E45742',
  concept: '#6B7280',
}

// What an address bar shows: the host of the live site, without protocol or www.
function siteAddress(url?: string): string | undefined {
  if (!url) return undefined
  try { return new URL(url).host.replace(/^www./, '') } catch { return undefined }
}

export default function ProjectDetailView({ project, locale, t, statusLabel }: { project: Project; locale: Locale; t: Dictionary['projects']; statusLabel: Record<string, string> }) {
  // One picture or none: the page is exactly what it has always been.
  const images = projectImages(project)
  const phoneImages = mobileImages(project)
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
      {/* Back */}
      <FadeIn>
        <Link
          href={`/${locale}/projects`}
          className="inline-flex items-center gap-2 text-sm font-medium mb-16 transition-colors duration-200 hover:text-[var(--accent)]"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
        >
          <Icon name="arrowLeft" size={16} />
          {t.allProjectsLink}
        </Link>
      </FadeIn>

      <div className="grid lg:grid-cols-[1fr_320px] gap-12 items-start">
        {/* Main */}
        <div className="min-w-0">
          <FadeIn delay={0.05}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tag">{project.category}</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2"
                    style={{ background: statusColor[project.status] ?? '#6B7280' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                    {statusLabel[project.status]}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  {project.year}
                </span>
              </div>
              <ShareButton
                title={project.title}
                text={project.description}
                url={`/${locale}/projects/${project.slug}`}
                label={t.share}
                copiedLabel={t.shareCopied}
                copyLinkLabel={t.shareCopyLink}
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1
              className="font-display font-bold mb-6"
              style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', color: 'var(--text)' }}
            >
              {project.title}
            </h1>
          </FadeIn>

          <FadeIn delay={0.15}>
            <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
              {project.longDescription}
            </p>
          </FadeIn>

          {project.liveUrl && (
            <FadeIn delay={0.18}>
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-base px-8 py-4 mb-10"
              >
                <Icon name="externalLink" size={16} />
                {t.viewLive}
              </a>
            </FadeIn>
          )}

          {/* Image / placeholder */}
          <FadeIn delay={0.2}>
            {images.length > 1 || phoneImages.length > 0 ? (
              <div className="mb-10">
                <ProjectMedia
                  desktop={images}
                  mobile={phoneImages}
                  title={project.title}
                  address={siteAddress(project.liveUrl)}
                  labels={t.gallery}
                  fallback={
                    <div className="w-full flex items-center justify-center" style={{ aspectRatio: '16/9', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{t.previewUnavailable}</p>
                    </div>
                  }
                />
              </div>
            ) : (
            <div
              className="relative w-full rounded-2xl overflow-hidden mb-10"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                aspectRatio: '16/9',
              }}
            >
              {images[0] ? (
                <ProjectPicture
                  src={images[0]}
                  alt={project.title}
                  priority
                  sizes="(min-width: 1024px) 800px, 100vw"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--accent-glow)' }}
                  >
                    <Icon name="layers" size={24} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                    {t.previewUnavailable}
                  </p>
                </div>
              )}
            </div>
            )}
          </FadeIn>

          {/* Tags */}
          <FadeIn delay={0.25}>
            <div>
              <p className="section-label mb-4">{t.technologiesUsed}</p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span key={tag} className="tag text-sm">{tag}</span>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Case study */}
          {(project.caseStudyContext || project.caseStudySolution || project.caseStudyResults) && (
            <FadeIn delay={0.3}>
              <div className="mt-14">
                <h2 className="section-label mb-6">{t.caseStudyLabel}</h2>
                <div className="space-y-8">
                  {[
                    { label: t.caseStudyContext, text: project.caseStudyContext },
                    { label: t.caseStudySolution, text: project.caseStudySolution },
                    { label: t.caseStudyResults, text: project.caseStudyResults },
                  ].filter((s) => s.text).map((s) => (
                    <div key={s.label} className="card p-6">
                      <h3 className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>
                        {s.label}
                      </h3>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>
                        {s.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}
        </div>

        {/* Sidebar */}
        <FadeIn delay={0.3} direction="left" className="space-y-4">
          {/* Links */}
          {(project.liveUrl || project.githubUrl) && (
            <div className="card p-5 space-y-3">
              <p className="section-label mb-2">{t.links}</p>
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full justify-center text-sm py-3"
                >
                  <Icon name="externalLink" size={14} />
                  {t.viewLive}
                </a>
              )}
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary w-full justify-center text-sm py-3"
                >
                  <Icon name="github" size={14} />
                  {t.viewSource}
                </a>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="card p-5 space-y-4">
            <p className="section-label">{t.infoLabel}</p>
            {[
              { label: t.category, value: project.category },
              { label: t.year, value: project.year },
              { label: t.statusLabel, value: statusLabel[project.status] ?? project.status },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>{label}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text)', fontFamily: 'var(--font-space-grotesk)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Nav projets */}
          <div className="card p-5">
            <Link
              href={`/${locale}/projects`}
              className="flex items-center justify-between text-sm font-medium transition-colors duration-200 hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
            >
              {t.viewAllProjects}
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
