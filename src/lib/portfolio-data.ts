import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getDb } from '@/lib/mongodb'
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
  defaultDocuments,
} from '@/data/defaultData'

// Server-side portfolio reads. Deliberately NOT in a 'use server' file: every
// export of such a file is a Server Action, reachable by a direct POST from
// anyone who knows its ID, and none of these functions checks for an admin
// session (public pages call them anonymously). Keeping them here means they
// can only be called from server code; the back-office reaches the data through
// the guarded wrappers in actions/portfolio.ts.

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
  documents: defaultDocuments,
}

async function fetchPortfolioFromDb(): Promise<PortfolioData | null> {
  const db = await getDb()
  const doc = await db.collection('portfolio').findOne({ _id: DOC_ID as unknown as never })
  if (!doc) return null
  const { _id: _docId, updatedAt: _updatedAt, ...data } = doc
  return { ...DEFAULTS, ...data } as PortfolioData
}

// The document together with a marker of the version it was read at (its
// updatedAt). Used to change one part of the portfolio only if nobody else changed
// the document in between — see lib/portfolio-write.ts.
export async function readPortfolioWithVersion(): Promise<{ data: PortfolioData; version: string } | null> {
  const db = await getDb()
  const doc = await db.collection('portfolio').findOne({ _id: DOC_ID as unknown as never })
  if (!doc) return null
  const { _id: _docId, updatedAt, ...data } = doc
  return { data: { ...DEFAULTS, ...data } as PortfolioData, version: updatedAt instanceof Date ? updatedAt.toISOString() : 'none' }
}

// Cached + tagged — the version every public-facing reader should use
// (pages, API routes, the chatbot, sitemap, bookings' availability rules).
// react's `cache()` dedupes calls within a single request on top of
// `unstable_cache`'s cross-request cache, which `publishPortfolio` invalidates
// on-demand via `updateTag('portfolio')`; `revalidate: 30` is only a fallback
// if that tag invalidation is ever missed.
export const fetchPortfolio = cache(
  unstable_cache(fetchPortfolioFromDb, ['portfolio'], { tags: ['portfolio'], revalidate: 30 }),
)

// Uncached — reads MongoDB directly, every time. Reserved for
// PortfolioContext's syncAndPublish(), which must merge against the true
// current state right before publishing so a stale open tab can never
// clobber fields it never touched. Do not use this for rendering; it
// defeats the point of the cached version above.
export const fetchPortfolioFresh = fetchPortfolioFromDb

// Every public page/route falls back to hardcoded placeholder data
// (defaultProjects, etc.) when fetchPortfolio() fails, rather than showing
// an error screen to a visitor over a transient Mongo hiccup. That's the
// right call for visitors, but a bare `.catch(() => null)` at each of the
// dozen call sites made those failures completely invisible — nothing in
// the server logs ever showed that real data had silently been swapped for
// placeholders. This centralizes the fallback so every call site logs the
// same way; the behavior (fall back to null → caller's own defaults) is
// unchanged.
export async function fetchPortfolioSafe(context: string): Promise<PortfolioData | null> {
  try {
    return await fetchPortfolio()
  } catch (err) {
    console.error(`[fetchPortfolioSafe] ${context}: fetchPortfolio() failed, falling back to defaults`, err)
    return null
  }
}
