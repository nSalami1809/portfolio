'use server'

import { requireAdmin } from '@/lib/require-admin'
import { headers } from 'next/headers'
import { pushCol } from '@/lib/push'

interface SubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const valid = (s: SubscriptionInput | undefined): s is SubscriptionInput =>
  !!s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && s.endpoint.length < 1000 &&
  typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string' && s.keys.p256dh.length < 200 && s.keys.auth.length < 100

export async function savePushSubscription(sub: SubscriptionInput): Promise<{ ok: boolean }> {
  await requireAdmin()
  if (!valid(sub)) return { ok: false }
  const col = await pushCol()
  const userAgent = ((await headers()).get('user-agent') ?? '').slice(0, 200)
  await col.updateOne(
    { endpoint: sub.endpoint },
    { $set: { keys: sub.keys, userAgent }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  )
  return { ok: true }
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  if (typeof endpoint !== 'string') return { ok: false }
  const col = await pushCol()
  await col.deleteOne({ endpoint })
  return { ok: true }
}
