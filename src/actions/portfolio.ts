'use server'

import { cache } from 'react'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/mongodb'
import { requireAdmin } from '@/lib/require-admin'
import type { PortfolioData } from '@/types'
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
  defaultOffers,
  defaultAvailability,
} from '@/data/defaultData'

const DOC_ID = 'main'

// Documents saved before a given field existed simply don't have that key in
// MongoDB — merging over these defaults means adding a new top-level field
// to PortfolioData can never again crash existing users on `undefined`
// (e.g. `.length`/`.map` on a field that predates it).
const DEFAULTS: PortfolioData = {
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
  offers: defaultOffers,
  availability: defaultAvailability,
}

export async function publishPortfolio(data: PortfolioData): Promise<void> {
  await requireAdmin()

  const db = await getDb()
  await db.collection('portfolio').updateOne(
    { _id: DOC_ID as unknown as never },
    { $set: { ...data, _id: DOC_ID as unknown as never, updatedAt: new Date() } },
    { upsert: true },
  )
  // Bust the ISR cache so the home page reflects changes immediately
  revalidatePath('/')
}

// React.cache dedupes this within a single request — the root layout and a
// page (e.g. `/`) both call this to seed their initial render, and without
// memoization that would mean two MongoDB round trips per request.
export const fetchPortfolio = cache(async (): Promise<PortfolioData | null> => {
  const db = await getDb()
  const doc = await db.collection('portfolio').findOne({ _id: DOC_ID as unknown as never })
  if (!doc) return null
  const { _id: _docId, updatedAt: _updatedAt, ...data } = doc
  return { ...DEFAULTS, ...data } as PortfolioData
})
