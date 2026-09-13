import { headers } from 'next/headers'

// `x-forwarded-for`'s leftmost hop is whatever the client sent — an attacker
// can rotate it per request to defeat every IP-keyed rate limiter in the app
// (admin login, the ADMIN_ACCESS_TOKEN gate, quote/booking/contact
// throttles). Vercel's edge strips any client-supplied `x-vercel-forwarded-for`
// and sets it itself, so it's the trustworthy source when present; otherwise
// fall back to the rightmost `x-forwarded-for` hop (the one *this* server's
// immediate proxy appended, not the client) or `x-real-ip`.
export function clientIpFromHeaders(h: Headers): string {
  const vercelIp = h.get('x-vercel-forwarded-for')
  if (vercelIp) return vercelIp.split(',')[0].trim()
  const forwardedFor = h.get('x-forwarded-for')
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((hop) => hop.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }
  return h.get('x-real-ip') ?? 'unknown'
}

// Same, for Server Actions (no Request object — headers come from next/headers).
export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers())
}
