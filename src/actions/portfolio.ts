'use server'

import { updateTag } from 'next/cache'
import { getDb } from '@/lib/mongodb'
import { requireAdmin } from '@/lib/require-admin'
import { fetchPortfolio, fetchPortfolioFresh } from '@/lib/portfolio-data'
import type { PortfolioData } from '@/types'

const DOC_ID = 'main'

// Everything exported here is a Server Action, i.e. callable by a direct POST:
// each one must check the admin session itself. Server-side readers live in
// lib/portfolio-data.ts (not an action file) for exactly that reason.

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

// Back-office readers for PortfolioContext (a client component, so it needs
// Server Actions). Same data as the public readers, but only for an admin:
// the document holds unpublished posts and the business settings.
export async function fetchPortfolioForAdmin(): Promise<PortfolioData | null> {
  await requireAdmin()
  return fetchPortfolio()
}

export async function fetchPortfolioFreshForAdmin(): Promise<PortfolioData | null> {
  await requireAdmin()
  return fetchPortfolioFresh()
}
