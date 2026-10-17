import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/admin-token'

// Server Actions are callable directly (POST + Next-Action header) by
// anyone who can read the action reference out of the client bundle —
// the /admin/* route gate in proxy.ts only protects the page navigation,
// not the action call itself, since the request targets whatever page
// the calling component was rendered on (which can be a public page, if
// the component is bundled there). Every admin-only action must verify
// the session itself rather than relying on which page happened to call it.
export async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get('admin-token')?.value
  if (!(await verifyAdminToken(token))) throw new Error('Non autorisé.')
}
