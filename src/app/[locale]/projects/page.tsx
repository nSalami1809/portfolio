'use client'

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import FadeIn from '@/components/animations/FadeIn'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { translateText } from '@/actions/translate'

const StarsCanvas = dynamic(() => import('@/components/scene/StarsCanvas').then((m) => m.StarsCanvas), { ssr: false })

type Translated = Record<string, { title: string; description: string }>

export default function ProjectsPage() {
  const { data } = usePortfolio()
  const { projects } = data
  const locale = useLocale()
  const t = useDictionary()

  const categories = useMemo(
    () => [t.projects.all, ...Array.from(new Set(projects.map((p) => p.category)))],
    [projects, t.projects.all],
  )
  const [active, setActive] = useState(t.projects.all)

  useEffect(() => { setActive(t.projects.all) }, [t.projects.all]) // eslint-disable-line react-hooks/set-state-in-effect

  const filtered = useMemo(
    () => (active === t.projects.all ? projects : projects.filter((p) => p.category === active)),
    [projects, active, t.projects.all],
  )

  const [translated, setTranslated] = useState<Translated>({})

  useEffect(() => {
    if (locale !== 'en' || projects.length === 0) { setTranslated({}); return } // eslint-disable-line react-hooks/set-state-in-effect
    let cancelled = false
    Promise.all(
      projects.map(async (p) => {
        const fields = await translateText(`project:${p.slug}`, 'en', { title: p.title, description: p.description })
        return [p.slug, { title: fields.title ?? p.title, description: fields.description ?? p.description }] as const
      }),
    ).then((entries) => { if (!cancelled) setTranslated(Object.fromEntries(entries)) }).catch(() => {})
    return () => { cancelled = true }
  }, [locale, projects])

  const statusLabel: Record<string, string> = t.status
  const statusColor: Record<string, string> = {
    completed: '#10B981',
    'in-progress': '#F59E0B',
    concept: '#6B7280',
  }

  return (
    <div className="relative">
      {/* Full-page starfield background */}
      <StarsCanvas className="z-0 pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20">
      {/* Hero */}
      <div className="mb-20">
        <FadeIn>
          <p className="section-label mb-3">{t.projects.label}</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
            {t.projects.title}
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)', maxWidth: 500 }}>
            {t.projects.subtitle}
          </p>
        </FadeIn>
      </div>

      {/* Filters */}
      <FadeIn>
        <div className="flex flex-wrap gap-2 mb-12" role="group" aria-label={t.projects.filterAria}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              aria-pressed={active === cat}
              className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200"
              style={{
                fontFamily: 'var(--font-poppins)',
                background: active === cat ? 'var(--accent)' : 'var(--surface)',
                color: active === cat ? 'var(--accent-contrast)' : 'var(--text-muted)',
                border: active === cat ? '1px solid var(--accent)' : '1px solid var(--border)',
                transform: active === cat ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Grid */}
      <motion.div layout className="grid sm:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((project, i) => {
            const tp = translated[project.slug]
            return (
            <motion.div
              key={project.slug}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.3) }}
            >
              <Link href={`/${locale}/projects/${project.slug}`} className="card block p-6 h-full group">
                {/* Category & status */}
                <div className="flex items-center justify-between mb-5">
                  <span className="tag">{project.category}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: statusColor[project.status] ?? '#6B7280' }}
                      aria-hidden="true"
                    />
                    <span className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                      {statusLabel[project.status]}
                    </span>
                  </div>
                </div>

                {/* Image */}
                {project.image ? (
                  <div className="relative w-full aspect-video rounded-xl mb-5 overflow-hidden">
                    <Image
                      src={project.image}
                      alt={tp?.title ?? project.title}
                      fill
                      loading="lazy"
                      sizes="(min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-full aspect-video rounded-xl mb-5 flex items-center justify-center overflow-hidden"
                    style={{ background: 'var(--surface-hover)' }}
                    aria-hidden="true"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-glow)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }}>
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                    </div>
                  </div>
                )}

                <h3
                  className="font-display font-semibold text-xl mb-3 transition-colors duration-200 group-hover:text-[var(--accent)]"
                  style={{ color: 'var(--text)' }}
                >
                  {tp?.title ?? project.title}
                </h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
                  {tp?.description ?? project.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-5">
                  {project.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>

                <div
                  className="flex items-center gap-2 text-sm font-medium transition-all duration-200 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1"
                  style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}
                  aria-hidden="true"
                >
                  {t.projects.viewProject}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              </Link>
            </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>

      {filtered.length === 0 && (
        <div className="py-20 text-center" style={{ color: 'var(--text-muted)' }}>
          {t.projects.empty}
        </div>
      )}
      </div>
    </div>
  )
}
