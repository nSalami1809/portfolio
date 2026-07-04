'use client'

import Link from 'next/link'
import type { Project } from '@/types'
import FadeIn from '@/components/animations/FadeIn'

const statusLabel: Record<string, string> = {
  completed: 'Terminé',
  'in-progress': 'En cours',
  concept: 'Concept',
}
const statusColor: Record<string, string> = {
  completed: '#10B981',
  'in-progress': '#F59E0B',
  concept: '#6B7280',
}

export default function ProjectDetailView({ project }: { project: Project }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
      {/* Back */}
      <FadeIn>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm font-medium mb-16 transition-colors duration-200 hover:text-[var(--accent)]"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Tous les projets
        </Link>
      </FadeIn>

      <div className="grid lg:grid-cols-[1fr_320px] gap-12 items-start">
        {/* Main */}
        <div>
          <FadeIn delay={0.05}>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="tag">{project.category}</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
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
            <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--text-muted)' }}>
              {project.longDescription}
            </p>
          </FadeIn>

          {/* Image / placeholder */}
          <FadeIn delay={0.2}>
            <div
              className="w-full rounded-2xl overflow-hidden mb-10"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                aspectRatio: '16/9',
              }}
            >
              {project.image ? (
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--accent-glow)' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }}>
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                    Aperçu non disponible
                  </p>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Tags */}
          <FadeIn delay={0.25}>
            <div>
              <p className="section-label mb-4">Technologies utilisées</p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span key={tag} className="tag text-sm">{tag}</span>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Sidebar */}
        <FadeIn delay={0.3} direction="left" className="space-y-4">
          {/* Links */}
          {(project.liveUrl || project.githubUrl) && (
            <div className="card p-5 space-y-3">
              <p className="section-label mb-2">Liens</p>
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full justify-center text-sm py-3"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                  </svg>
                  Voir en ligne
                </a>
              )}
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary w-full justify-center text-sm py-3"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  Code source
                </a>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="card p-5 space-y-4">
            <p className="section-label">Informations</p>
            {[
              { label: 'Catégorie', value: project.category },
              { label: 'Année', value: project.year },
              { label: 'Statut', value: statusLabel[project.status] ?? project.status },
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
              href="/projects"
              className="flex items-center justify-between text-sm font-medium transition-colors duration-200 hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
            >
              Voir tous les projets
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
