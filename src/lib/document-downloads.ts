import 'server-only'
import { getDb } from '@/lib/mongodb'

// One small record per counted download: which document and when. No IP, no cookie, no user agent.
// Records expire on their own after 400 days, like the page views.
const COLLECTION = 'document_downloads'
const TTL_SECONDS = 400 * 86_400

let indexReady: Promise<void> | null = null
function ensureIndex() {
  if (!indexReady) {
    indexReady = getDb()
      .then((db) => db.collection(COLLECTION).createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS }))
      .then(() => {})
      .catch(() => {})
  }
  return indexReady
}

export async function recordDocumentDownload(slug: string): Promise<void> {
  try {
    await ensureIndex()
    const db = await getDb()
    await db.collection(COLLECTION).insertOne({ slug: slug.slice(0, 200), createdAt: new Date() })
  } catch {
    // Never let a counting hiccup reach the visitor
  }
}

export interface DocumentDownloads { total: number; last30Days: number }

/** Downloads per document slug, since counting began and over the last 30 days. */
export async function getDocumentDownloads(now: Date = new Date()): Promise<Record<string, DocumentDownloads>> {
  const db = await getDb()
  const since = new Date(now.getTime() - 30 * 86_400_000)
  const rows = await db.collection(COLLECTION).aggregate<{ _id: string; total: number; recent: number }>([
    { $group: { _id: '$slug', total: { $sum: 1 }, recent: { $sum: { $cond: [{ $gte: ['$createdAt', since] }, 1, 0] } } } },
  ]).toArray()
  return Object.fromEntries(rows.map((r) => [r._id, { total: r.total, last30Days: r.recent }]))
}
