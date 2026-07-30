import { getDb } from '@/lib/mongodb'

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL!

// The admin email can be overridden from /admin/settings (stored in
// `admin_config` alongside the password hash) — this always resolves the
// address currently in effect instead of the static env var.
export async function getAdminEmail(): Promise<string> {
  const db = await getDb()
  const cfg = await db.collection('admin_config').findOne({ _id: 'email' as unknown as import('mongodb').ObjectId })
  return (cfg?.email as string | undefined)?.trim() || DEFAULT_ADMIN_EMAIL
}
