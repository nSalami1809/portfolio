import { jwtVerify } from 'jose'
import { getJwtSecret } from '@/lib/jwt-secret'

// The one place that decides whether the `admin-token` cookie is a genuine admin
// session: signed with our secret (HS256 only), not expired, AND carrying the
// admin role the login step puts in it. Every guard of the back-office (proxy, server
// actions, API routes) goes through here, so a token signed with the same secret for
// some other purpose could never open the admin.
export async function verifyAdminToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] })
    return payload.role === 'admin'
  } catch {
    return false
  }
}
