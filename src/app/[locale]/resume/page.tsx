'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import FadeIn from '@/components/animations/FadeIn'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { translateText } from '@/actions/translate'

const StarsCanvas = dynamic(() => import('@/components/scene/StarsCanvas').then((m) => m.StarsCanvas), { ssr: false })

type ExpTranslated = Record<string, { role: string; description: string }>
type EduTranslated = Record<string, { degree: string; detail: string }>

export default function ResumePage() {
  const { data } = usePortfolio()
  const locale = useLocale()
  const t = useDictionary()

  const [expT, setExpT] = useState<ExpTranslated>({})
  const [eduT, setEduT] = useState<EduTranslated>({})

  useEffect(() => {
    if (locale !== 'en' || data.experiences.length === 0) { setExpT({}); return } // eslint-disable-line react-hooks/set-state-in-effect
    let cancelled = false
    Promise.all(
      data.experiences.map(async (exp) => {
        const fields = await translateText(`experience:${exp.id}`, 'en', { role: exp.role, description: exp.description })
        return [exp.id, { role: fields.role ?? exp.role, description: fields.description ?? exp.description }] as const
      }),
    ).then((entries) => { if (!cancelled) setExpT(Object.fromEntries(entries)) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, data.experiences.length])

  useEffect(() => {
    if (locale !== 'en' || data.educations.length === 0) { setEduT({}); return } // eslint-disable-line react-hooks/set-state-in-effect
    let cancelled = false
    Promise.all(
      data.educations.map(async (edu) => {
        const fields = await translateText(`education:${edu.id}`, 'en', { degree: edu.degree, detail: edu.detail ?? '' })
        return [edu.id, { degree: fields.degree ?? edu.degree, detail: fields.detail ?? edu.detail ?? '' }] as const
      }),
    ).then((entries) => { if (!cancelled) setEduT(Object.fromEntries(entries)) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, data.educations.length])

  return (
    <div className="relative">
      {/* Full-page starfield background */}
      <StarsCanvas hue={260} className="z-0 pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-20">
      {/* Hero */}
      <div className="mb-20">
        <FadeIn>
          <p className="section-label mb-3">{t.resume.label}</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
            {t.resume.title}
          </h1>
          <p className="text-lg mb-6" style={{ color: 'var(--text-muted)', maxWidth: 500 }}>
            {t.resume.subtitle}
          </p>
          {data.personal.cvUrl && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- forces a file download (Content-Disposition), not a page navigation
            <a href="/api/cv" className="btn-primary">
              {t.resume.downloadCv}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
            </a>
          )}
        </FadeIn>
      </div>

      {/* ── Expériences ── */}
      <section className="mb-20">
        <FadeIn>
          <p className="section-label mb-10">{t.resume.experiencesLabel}</p>
        </FadeIn>

        <div className="relative pl-6 sm:pl-8" style={{ borderLeft: '2px solid var(--border)' }}>
          {data.experiences.map((exp, i) => {
            const trExp = expT[exp.id]
            return (
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
                      <Image
                        src={exp.companyLogo}
                        alt={exp.company}
                        width={44}
                        height={44}
                        loading="lazy"
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
                          {trExp?.role ?? exp.role}
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
                    {trExp?.description ?? exp.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {exp.tags.map((tag) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
            )
          })}
        </div>
      </section>

      <div className="divider" />

      {/* ── Compétences ── */}
      <section className="mb-20">
        <FadeIn>
          <p className="section-label mb-10">{t.resume.skillsLabel}</p>
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
                            <Image
                              src={icon}
                              alt=""
                              aria-hidden="true"
                              width={20}
                              height={20}
                              loading="lazy"
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
          <p className="section-label mb-10">{t.resume.educationLabel}</p>
        </FadeIn>

        <div className="space-y-4">
          {data.educations.map((edu, i) => {
            const trEdu = eduT[edu.id]
            return (
            <FadeIn key={edu.id} delay={i * 0.08}>
              <div className="card p-6">
                <div className="flex items-start gap-4">
                  {/* School logo */}
                  {edu.schoolLogo ? (
                    <Image
                      src={edu.schoolLogo}
                      alt={edu.school}
                      width={48}
                      height={48}
                      loading="lazy"
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
                        {trEdu?.degree ?? edu.degree}
                      </h3>
                      <p className="text-sm font-medium mb-2" style={{ color: 'var(--accent)', fontFamily: 'var(--font-poppins)' }}>{edu.school}</p>
                      {edu.detail && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{trEdu?.detail || edu.detail}</p>
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
            )
          })}
        </div>
      </section>
      </div>
    </div>
  )
}
