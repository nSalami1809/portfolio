'use server'

import { cache } from 'react'
import { updateTag, unstable_cache } from 'next/cache'
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
  // Immediate expiration for every reader tagged 'portfolio' (pages, API
  // routes, the chatbot, sitemap, bookings' availability rules) — the next
  // request after a publish always recomputes, no stale-while-revalidate
  // window. (revalidateTag('portfolio', 'max') would only mark it stale
  // and still serve one more cached response in the meantime.) updateTag
  // requires a genuine Server Action context, which publishPortfolio is —
  // guarded anyway so the write above can never be undone by a cache-layer
  // failure; the 30s `revalidate` on the cache itself is the fallback here.
  try {
    updateTag('portfolio')
  } catch (err) {
    console.error('publishPortfolio: updateTag failed, relying on the 30s cache fallback', err)
  }
}

async function fetchPortfolioFromDb(): Promise<PortfolioData | null> {
  const db = await getDb()
  const doc = await db.collection('portfolio').findOne({ _id: DOC_ID as unknown as never })
  if (!doc) return null
  const { _id: _docId, updatedAt: _updatedAt, ...data } = doc
  return { ...DEFAULTS, ...data } as PortfolioData
}

// Cached + tagged — the version every public-facing reader should use
// (pages, API routes, the chatbot, sitemap, bookings' availability rules).
// react's `cache()` dedupes calls within a single request on top of
// `unstable_cache`'s cross-request cache, which `publishPortfolio` above
// invalidates on-demand via `updateTag('portfolio')`; `revalidate: 30`
// is only a fallback if that tag invalidation is ever missed.
export const fetchPortfolio = cache(
  unstable_cache(fetchPortfolioFromDb, ['portfolio'], { tags: ['portfolio'], revalidate: 30 }),
)

// Uncached — reads MongoDB directly, every time. Reserved for
// PortfolioContext's syncAndPublish(), which must merge against the true
// current state right before publishing so a stale open tab can never
// clobber fields it never touched. Do not use this for rendering; it
// defeats the point of the cached version above.
export const fetchPortfolioFresh = fetchPortfolioFromDb
