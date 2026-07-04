'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { PortfolioData, PersonalInfo, SocialLinks, Project, Experience, Education, Skill, Testimonial, SiteSettings, VisionData, BlogPost } from '@/types'
import {
  defaultPersonalInfo,
  defaultSocials,
  defaultProjects,
  defaultExperiences,
  defaultEducations,
  defaultSkills,
  defaultTestimonials,
  defaultSettings,
  defaultVision,
  defaultBlogPosts,
} from '@/data/defaultData'
import { publishPortfolio } from '@/actions/portfolio'

const STORAGE_KEY = 'portfolio-data'

const defaultData: PortfolioData = {
  personal: defaultPersonalInfo,
  socials: defaultSocials,
  projects: defaultProjects,
  experiences: defaultExperiences,
  educations: defaultEducations,
  skills: defaultSkills,
  testimonials: defaultTestimonials,
  settings: defaultSettings,
  vision: defaultVision,
  blog: defaultBlogPosts,
}

interface PortfolioContextValue {
  data: PortfolioData
  updatePersonal: (info: PersonalInfo) => void
  updateSocials: (socials: SocialLinks) => void
  updateProjects: (projects: Project[]) => void
  updateExperiences: (experiences: Experience[]) => void
  updateEducations: (educations: Education[]) => void
  updateSkills: (skills: Skill[]) => void
  updateTestimonials: (testimonials: Testimonial[]) => void
  updateSettings: (settings: SiteSettings) => void
  updateVision: (vision: VisionData) => void
  updateBlogPosts: (blog: BlogPost[]) => void
  resetAll: () => void
}

const noop = () => {}

// Non-null default so SSR never throws when the provider isn't mounted yet.
// The real values are provided by PortfolioProvider once hydrated.
const PortfolioContext = createContext<PortfolioContextValue>({
  data: defaultData,
  updatePersonal: noop,
  updateSocials: noop,
  updateProjects: noop,
  updateExperiences: noop,
  updateEducations: noop,
  updateSkills: noop,
  updateTestimonials: noop,
  updateSettings: noop,
  updateVision: noop,
  updateBlogPosts: noop,
  resetAll: noop,
})

type Patcher = (prev: PortfolioData) => PortfolioData
type Setter  = React.Dispatch<React.SetStateAction<PortfolioData>>

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PortfolioData>(defaultData)
  const hydratedFromMongo = useRef(false)
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestData = useRef<PortfolioData>(defaultData)

  // Keep ref in sync so flush callbacks always see latest state
  useEffect(() => { latestData.current = data }, [data])

  // Flush any pending publish immediately (used on tab hide / unload)
  const flushPublish = useCallback(() => {
    if (!publishTimer.current) return
    clearTimeout(publishTimer.current)
    publishTimer.current = null
    publishPortfolio(latestData.current).catch(() => {})
  }, [])

  // Guarantee data reaches MongoDB even if user closes/switches tab within debounce window
  useEffect(() => {
    const onHide = () => { if (document.hidden) flushPublish() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', flushPublish)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', flushPublish)
    }
  }, [flushPublish])

  const schedulePublish = useCallback((next: PortfolioData) => {
    if (publishTimer.current) clearTimeout(publishTimer.current)
    publishTimer.current = setTimeout(() => { publishPortfolio(next).catch(() => {}) }, 2000)
  }, [])

  const persist = useCallback((setter: Setter, patch: Patcher) => {
    setter((prev) => {
      const next = patch(prev)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota / SSR */ }
      schedulePublish(next)
      return next
    })
  }, [schedulePublish])

  useEffect(() => {
    // 1 — localStorage first paint only (avoids a flash of default content
    // while the network request below is in flight). It never has the final word.
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PortfolioData>
          // eslint-disable-next-line react-hooks/set-state-in-effect
        setData((prev) => ({ ...prev, ...parsed }))
      }
    } catch { /* unavailable / invalid */ }

    // 2 — MongoDB is the single source of truth and always wins once it
    // loads. A local draft can silently desync from what was actually
    // published (e.g. localStorage quota exceeded while saving large
    // uploaded images), so it must never permanently hide real changes.
    fetch('/api/portfolio', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((json: { data: PortfolioData | null } | null) => {
        if (!json?.data || hydratedFromMongo.current) return
        hydratedFromMongo.current = true
        setData(json.data)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(json.data)) } catch { /* quota */ }
      })
      .catch(() => {})
  }, [])

  const updatePersonal     = useCallback((personal: PersonalInfo)      => persist(setData, (p) => ({ ...p, personal })), [persist])
  const updateSocials      = useCallback((socials: SocialLinks)         => persist(setData, (p) => ({ ...p, socials })), [persist])
  const updateProjects     = useCallback((projects: Project[])          => persist(setData, (p) => ({ ...p, projects })), [persist])
  const updateExperiences  = useCallback((experiences: Experience[])    => persist(setData, (p) => ({ ...p, experiences })), [persist])
  const updateEducations   = useCallback((educations: Education[])      => persist(setData, (p) => ({ ...p, educations })), [persist])
  const updateSkills       = useCallback((skills: Skill[])              => persist(setData, (p) => ({ ...p, skills })), [persist])
  const updateTestimonials = useCallback((testimonials: Testimonial[])  => persist(setData, (p) => ({ ...p, testimonials })), [persist])
  const updateSettings     = useCallback((settings: SiteSettings)       => persist(setData, (p) => ({ ...p, settings })), [persist])
  const updateVision       = useCallback((vision: VisionData)           => persist(setData, (p) => ({ ...p, vision })), [persist])
  const updateBlogPosts    = useCallback((blog: BlogPost[])             => persist(setData, (p) => ({ ...p, blog })), [persist])

  const resetAll = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setData(defaultData)
    publishPortfolio(defaultData).catch(() => {})
  }, [])

  const value = useMemo<PortfolioContextValue>(() => ({
    data,
    updatePersonal, updateSocials, updateProjects, updateExperiences,
    updateEducations, updateSkills, updateTestimonials, updateSettings,
    updateVision, updateBlogPosts, resetAll,
  }), [data, updatePersonal, updateSocials, updateProjects, updateExperiences,
      updateEducations, updateSkills, updateTestimonials, updateSettings,
      updateVision, updateBlogPosts, resetAll])

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}
