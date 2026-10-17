import { getJwtSecret } from '@/lib/jwt-secret'

// The `admin-pre` cookie says "this browser passed the secret-code gate (or the
// password step) a few minutes ago": it opens the hidden login/verify pages. It
// used to be the constant "1", so anyone could set it by hand. It is now an expiry
// time plus an HMAC of that time, so it cannot be forged or kept past its expiry.
//
// It is NOT a session. In particular it is signed with a message prefix of its own
// ("admin-pre:") and has a different shape from the admin JWT, so it can never be
// replayed as an `admin-token`. Web Crypto only: this runs in the proxy as well.

export const PRE_AUTH_TTL_MS = 10 * 60 * 1000
const enc = new TextEncoder()

async function mac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', getJwtSecret() as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Length-independent comparison: no early exit on the first differing character.
function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

export async function signPreAuth(now: number = Date.now(), ttlMs: number = PRE_AUTH_TTL_MS): Promise<string> {
  const expires = now + ttlMs
  return `${expires}.${await mac(`admin-pre:${expires}`)}`
}

export async function verifyPreAuth(value: string | undefined | null, now: number = Date.now()): Promise<boolean> {
  if (!value || value.length > 200) return false
  const dot = value.indexOf('.')
  if (dot < 1) return false
  const expiresRaw = value.slice(0, dot)
  if (!/^\d{10,16}$/.test(expiresRaw)) return false
  const expires = Number(expiresRaw)
  if (!Number.isSafeInteger(expires) || expires <= now) return false
  return constantTimeEqual(value.slice(dot + 1), await mac(`admin-pre:${expires}`))
}
