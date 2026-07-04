'use client'

import dynamic from 'next/dynamic'
import FadeIn from '@/components/animations/FadeIn'
import { usePortfolio } from '@/providers/PortfolioContext'

const StarsCanvas = dynamic(() => import('@/components/scene/StarsCanvas').then((m) => m.StarsCanvas), { ssr: false })

export default function ResumePage() {
  const { data } = usePortfolio()

  return (
    <div className="relative">
      {/* Full-page starfield background */}
      <StarsCanvas hue={260} className="z-0 pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-20">
      {/* Hero */}
      <div className="mb-20">
        <FadeIn>
          <p className="section-label mb-3">Parcours</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
            Mon Expérience
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)', maxWidth: 500 }}>
            Parcours professionnel, compétences techniques et formations.
          </p>
        </FadeIn>
      </div>

      {/* ── Expériences ── */}
      <section className="mb-20">
        <FadeIn>
          <p className="section-label mb-10">Expériences professionnelles</p>
        </FadeIn>

        <div className="relative pl-6 sm:pl-8" style={{ borderLeft: '2px solid var(--border)' }}>
          {data.experiences.map((exp, i) => (
            <FadeIn key={exp.id} delay={i * 0.08}>
              <div className="relative mb-10 last:mb-0">
                {/* Dot */}
                <div
                  className="absolute -left-[1.65rem] sm:-left-[2.15rem] top-1.5 w-4 h-4 rounded-full border-2"
                  style={{ background: 'var(--accent)', borderColor: 'var(--bg)', boxShadow: '0 0 0 4px var(--accent-glow)' }}
                />

                <div className="card p-6 ml-4">
                  <div className="flex items-start gap-4 mb-3">
                    {/* Company logo */}
                    {exp.companyLogo ? (
                      <img
                        src={exp.companyLogo}
                        alt={exp.company}
                        loading="lazy"
                        decoding="async"
                        className="w-11 h-11 rounded-full object-cover flex-shrink-0 mt-0.5"
                        style={{ border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-display font-bold text-sm"
                        style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                        aria-hidden="true"
                      >
                        {(exp.company || exp.role).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display font-semibold text-xl" style={{ color: 'var(--text)' }}>
                          {exp.role}
                        </h3>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>
                          {exp.company}
                        </p>
                      </div>
                      <span
                        className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap"
                        style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
                      >
                        {exp.period}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
                    {exp.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {exp.tags.map((tag) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* ── Compétences ── */}
      <section className="mb-20">
        <FadeIn>
          <p className="section-label mb-10">Compétences techniques</p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 gap-4">
          {data.skills.map((skill, i) => (
            <FadeIn key={skill.id} delay={i * 0.07}>
              <div className="card p-6 h-full">
                <p className="font-display font-semibold text-lg mb-4" style={{ color: 'var(--text)' }}>
                  {skill.category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {skill.items.map((item) => {
                    const icon = skill.icons?.[item]
                    return (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-lg"
                        style={{
                          background: 'var(--surface-hover)',
                          border: '1px solid var(--border)',
                          padding: '0.4rem 0.8rem',
                        }}
                      >
                        {icon && (
                          <span
                            className="flex items-center justify-center rounded-md flex-shrink-0"
                            style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.92)' }}
                          >
                            <img
                              src={icon}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                              decoding="async"
                              className="w-5 h-5 object-contain"
                            />
                          </span>
                        )}
                        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                          {item}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* ── Formations ── */}
      <section>
        <FadeIn>
          <p className="section-label mb-10">Formations</p>
        </FadeIn>

        <div className="space-y-4">
          {data.educations.map((edu, i) => (
            <FadeIn key={edu.id} delay={i * 0.08}>
              <div className="card p-6">
                <div className="flex items-start gap-4">
                  {/* School logo */}
                  {edu.schoolLogo ? (
                    <img
                      src={edu.schoolLogo}
                      alt={edu.school}
                      loading="lazy"
                      decoding="async"
                      className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
                      style={{ border: '1px solid var(--border)', padding: '2px' }}
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
                      style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                      aria-hidden="true"
                    >
                      {(edu.school || edu.degree).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--text)' }}>
                        {edu.degree}
                      </h3>
                      <p className="text-sm font-medium mb-2" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>{edu.school}</p>
                      {edu.detail && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{edu.detail}</p>
                      )}
                    </div>
                    <span
                      className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap"
                      style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
                    >
                      {edu.year}
                    </span>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>
      </div>
    </div>
  )
}
