import { getOverviewStats, getViewsStats } from '@/lib/admin-stats-data'
import AdminDashboardView from './AdminDashboardView'

// Admin stats must always be live — never statically cached at build time.
export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const [overview, views] = await Promise.all([
    getOverviewStats(),
    getViewsStats('14d', 0),
  ])

  return <AdminDashboardView overview={overview} initialViews={views} />
}
