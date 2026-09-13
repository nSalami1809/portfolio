// `new TextEncoder().encode(undefined)` silently encodes the literal string
// "undefined" — a fixed, publicly-guessable JWT signing key — instead of
// throwing. Fail fast at first use so a missing env var is a boot-time error,
// not a silent auth bypass.
let cached: Uint8Array | null = null

export function getJwtSecret(): Uint8Array {
  if (cached) return cached
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET is not configured (or too short) — refusing to sign/verify admin tokens.')
  }
  cached = new TextEncoder().encode(secret)
  return cached
}
