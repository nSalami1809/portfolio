// Web push to the admin's devices (phone, laptop): a notification pops up even
// when the admin dashboard is closed. Subscriptions live in `push_subscriptions`
// (added from the admin bell). Everything here is best-effort and silent: no
// VAPID keys configured, no subscription, or a dead endpoint never breaks the
// action that triggered the notification.
import webpush from 'web-push'
import { getDb } from '@/lib/mongodb'

export interface PushSubscriptionRecord {
  endpoint: string
  keys: { p256dh: string; auth: string }
  createdAt: Date
  userAgent?: string
}

export interface AdminNotification {
  title: string
  body: string
  url?: string
}

export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)

export async function pushCol() {
  const db = await getDb()
  return db.collection<PushSubscriptionRecord>('push_subscriptions')
}

let configured = false
function configure() {
  if (configured) return true
  if (!pushConfigured()) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:nemrodsalami1809@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  configured = true
  return true
}

export async function notifyAdmin(n: AdminNotification): Promise<void> {
  if (process.env.E2E_DRY_RUN === '1' || !configure()) return
  try {
    const col = await pushCol()
    const subs = await col.find({}).toArray()
    if (subs.length === 0) return
    const payload = JSON.stringify({ title: n.title, body: n.body.slice(0, 300), url: n.url ?? '/admin' })
    const dead: string[] = []
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60 * 12 })
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) dead.push(s.endpoint) // unsubscribed / expired
        else console.error('[push] send failed:', status ?? e)
      }
    }))
    if (dead.length) await col.deleteMany({ endpoint: { $in: dead } })
  } catch (e) {
    console.error('[push] notifyAdmin failed:', e)
  }
}
