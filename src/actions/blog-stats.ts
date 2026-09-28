'use server'

import { requireAdmin } from '@/lib/require-admin'
import { getBlogPostViews } from '@/lib/admin-stats-data'

// Per-article page views (fr + en added together) for the admin blog list.
export async function getBlogViewCounts(): Promise<Record<string, number>> {
  await requireAdmin()
  return getBlogPostViews()
}
