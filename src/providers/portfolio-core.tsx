'use client'

// The portfolio context object and the read-only provider of the PUBLIC site.
// Kept apart from PortfolioContext.tsx (the admin editor: sample data, publish,
// polling…) so public pages never download any of that.
import { createContext, useContext, useMemo } from 'react'
import type { PortfolioData, PersonalInfo, SocialLinks, Project, Experience, Education, Skill, Testimonial, SiteSettings, VisionData, BlogPost, Offer, Availability } from '@/types'
import { emptyPublicPortfolio } from '@/lib/public-portfolio'

export interface PortfolioContextValue {
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
  updateOffers: (offers: Offer[]) => void
  updateAvailability: (availability: Availability) => void
  resetAll: () => void
}

const noop = () => {}

const readOnly = (data: PortfolioData): PortfolioContextValue => ({
  data,
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
  updateOffers: noop,
  updateAvailability: noop,
  resetAll: noop,
})

// Non-null default so SSR never throws when no provider is mounted.
export const PortfolioContext = createContext<PortfolioContextValue>(readOnly(emptyPublicPortfolio))

// Read-only provider for the PUBLIC site (the admin editor nests its own,
// editable provider inside this one). The data is a plain prop resolved
// server-side at the page's own ISR cadence: no fetch, no polling, correct in
// the SSR HTML. See lib/public-portfolio.ts for why it is deliberately small.
export function PortfolioStaticProvider({ data, children }: { data: PortfolioData; children: React.ReactNode }) {
  const value = useMemo(() => readOnly(data), [data])
  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}
