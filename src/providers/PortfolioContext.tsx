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
import { publishPortfolio, fetchPortfolio } from '@/actions/portfolio'

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

type Key = keyof PortfolioData

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PortfolioData>(defaultData)
  const hydratedFromMongo = useRef(false)
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestData = useRef<PortfolioData>(defaultData)
  // Top-level fields edited locally since the last successful publish.
  // Only these are ever pushed on top of a freshly-fetched server copy,
  // so a stale tab can never stomp fields it never touched.
  const dirtyKeys = useRef<Set<Key>>(new Set())
  const syncing = useRef(false)

  // Keep ref in sync so flush callbacks always see latest state
  useEffect(() => { latestData.current = data }, [data])

  // Debounced edits reconcile against a fresh server copy before publishing:
  // fetch the latest MongoDB state, overlay only the fields the admin
  // actually changed locally, publish that, and adopt it as local state.
  // This is what stops a long-open/stale tab from wiping out changes
  // made elsewhere (e.g. another tab, or a direct data fix) to fields
  // it never touched.
  const syncAndPublish = useCallback(async () => {
    if (dirtyKeys.current.size === 0 || syncing.current) return
    syncing.current = true
    const dirty = Array.from(dirtyKeys.current)
    dirtyKeys.current.clear()
    const local = latestData.current

    let base = local
    try {
      // Calls the server action directly (never the ISR-cached /api/portfolio
      // route) so the merge base is always truly current, not up to 15s stale.
      const fresh = await fetchPortfolio()
      if (fresh) base = fresh
    } catch { /* offline — fall back to publishing local state as-is */ }

    const merged: PortfolioData = { ...base }
    for (const key of dirty) {
      (merged as Record<Key, unknown>)[key] = (local as Record<Key, unknown>)[key]
    }

    try {
      await publishPortfolio(merged)
      setData(merged)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch { /* quota */ }
    } catch {
      // publish failed — re-mark as dirty so the next edit/timer retries
      dirty.forEach((k) => dirtyKeys.current.add(k))
    } finally {
      syncing.current = false
    }
  }, [])

  // Best-effort synchronous publish for tab hide/close — no time for the
  // fetch-and-merge round trip above, so it just sends local state as-is.
  const flushImmediate = useCallback(() => {
    if (publishTimer.current) { clearTimeout(publishTimer.current); publishTimer.current = null }
    if (dirtyKeys.current.size === 0) return
    dirtyKeys.current.clear()
    publishPortfolio(latestData.current).catch(() => {})
  }, [])

  // If the tab regains focus/visibility with no pending local edits, silently
  // refresh from MongoDB. This closes the main staleness gap: a tab left
  // open across a change made elsewhere is refreshed before the admin
  // starts editing again, instead of only once at initial page load.
  const refreshIfIdle = useCallback(async () => {
    if (dirtyKeys.current.size > 0 || syncing.current) return
    try {
      const fresh = await fetchPortfolio()
      if (fresh) {
        setData(fresh)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)) } catch { /* quota */ }
      }
    } catch { /* offline — keep current state */ }
  }, [])

  useEffect(() => {
    const onVisibility = () => { document.hidden ? flushImmediate() : refreshIfIdle() }
    const onFocus = () => refreshIfIdle()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', flushImmediate)
    window.addEventListener('focus', onFocus)
    // Safety net for long uninterrupted sessions that never blur/hide
    const interval = setInterval(refreshIfIdle, 45_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', flushImmediate)
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [flushImmediate, refreshIfIdle])

  const schedulePublish = useCallback(() => {
    if (publishTimer.current) clearTimeout(publishTimer.current)
    publishTimer.current = setTimeout(() => { syncAndPublish() }, 2000)
  }, [syncAndPublish])

  const persist = useCallback(<K extends Key>(key: K, value: PortfolioData[K]) => {
    dirtyKeys.current.add(key)
    setData((prev) => {
      const next = { ...prev, [key]: value }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota / SSR */ }
      return next
    })
    schedulePublish()
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
    // Uses the server action directly (never the ISR-cached /api/portfolio
    // route) so this is always the true current state, not stale by design.
    fetchPortfolio()
      .then((fresh) => {
        if (!fresh || hydratedFromMongo.current) return
        hydratedFromMongo.current = true
        setData(fresh)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)) } catch { /* quota */ }
      })
      .catch(() => {})
  }, [])

  const updatePersonal     = useCallback((personal: PersonalInfo)      => persist('personal', personal), [persist])
  const updateSocials      = useCallback((socials: SocialLinks)         => persist('socials', socials), [persist])
  const updateProjects     = useCallback((projects: Project[])          => persist('projects', projects), [persist])
  const updateExperiences  = useCallback((experiences: Experience[])    => persist('experiences', experiences), [persist])
  const updateEducations   = useCallback((educations: Education[])      => persist('educations', educations), [persist])
  const updateSkills       = useCallback((skills: Skill[])              => persist('skills', skills), [persist])
  const updateTestimonials = useCallback((testimonials: Testimonial[])  => persist('testimonials', testimonials), [persist])
  const updateSettings     = useCallback((settings: SiteSettings)       => persist('settings', settings), [persist])
  const updateVision       = useCallback((vision: VisionData)           => persist('vision', vision), [persist])
  const updateBlogPosts    = useCallback((blog: BlogPost[])             => persist('blog', blog), [persist])

  const resetAll = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    if (publishTimer.current) { clearTimeout(publishTimer.current); publishTimer.current = null }
    dirtyKeys.current.clear()
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
