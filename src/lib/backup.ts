// Database backup: every collection worth keeping is dumped (MongoDB Extended
// JSON, so dates and ids survive), compressed, encrypted (lib/backup-crypto.ts)
// and stored in the blob store. The last KEEP backups are kept; older ones are
// deleted. Run weekly by a cron (api/cron/backup) and on demand from the admin.
import { gzipSync } from 'zlib'
import { BSON, ObjectId } from 'mongodb'
import { put, del } from '@vercel/blob'
import { getDb } from '@/lib/mongodb'
import { encryptBackup, MIN_SECRET_LENGTH } from '@/lib/backup-crypto'

export const KEEP_BACKUPS = 8

// Throw-away data: rate-limit counters, dry-run mail captures, internal collections.
const SKIP = /^system\.|ratelimits?$|_rl$|^mail_dry_run$|^push_subscriptions$/

export interface BackupRecord {
  pathname: string
  url: string
  size: number
  createdAt: Date
  collections: Record<string, number>
}

export async function backupsCol() {
  const db = await getDb()
  return db.collection<BackupRecord>('backups')
}

export const backupConfigured = () => (process.env.BACKUP_ENCRYPTION_KEY ?? '').length >= MIN_SECRET_LENGTH

export async function createBackup(): Promise<{ ok: true; record: Omit<BackupRecord, 'url'> & { url?: string } } | { ok: false; error: string }> {
  const secret = process.env.BACKUP_ENCRYPTION_KEY ?? ''
  if (secret.length < MIN_SECRET_LENGTH) {
    return { ok: false, error: `BACKUP_ENCRYPTION_KEY manquante ou trop courte (${MIN_SECRET_LENGTH} caractères minimum) : aucune sauvegarde non chiffrée n'est faite.` }
  }

  const db = await getDb()
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => n !== 'backups' && !SKIP.test(n)).sort()
  const collections: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}
  for (const name of names) {
    const docs = await db.collection(name).find({}).toArray()
    collections[name] = docs.map((d) => BSON.EJSON.serialize(d, { relaxed: false }))
    counts[name] = docs.length
  }

  const createdAt = new Date()
  const json = JSON.stringify({ createdAt: createdAt.toISOString(), collections })
  const file = encryptBackup(gzipSync(Buffer.from(json, 'utf8')), secret)
  const pathname = `backups/backup-${createdAt.toISOString().replace(/[:.]/g, '-')}.nsb`

  if (process.env.E2E_DRY_RUN === '1') {
    return { ok: true, record: { pathname, size: file.length, createdAt, collections: counts } }
  }

  try {
    const blob = await put(pathname, file, { access: 'public', contentType: 'application/octet-stream', addRandomSuffix: true })
    const col = await backupsCol()
    await col.insertOne({ pathname: blob.pathname, url: blob.url, size: file.length, createdAt, collections: counts })
    await prune()
    return { ok: true, record: { pathname: blob.pathname, url: blob.url, size: file.length, createdAt, collections: counts } }
  } catch (e) {
    console.error('[backup] upload failed:', e)
    return { ok: false, error: "Échec de l'envoi de la sauvegarde vers le stockage." }
  }
}

// Keeps the most recent KEEP_BACKUPS, deletes the rest (file and record).
async function prune() {
  const col = await backupsCol()
  const old = await col.find({}).sort({ createdAt: -1 }).skip(KEEP_BACKUPS).toArray()
  if (old.length === 0) return
  await del(old.map((b) => b.url)).catch((e) => console.error('[backup] prune (blob) failed:', e))
  await col.deleteMany({ _id: { $in: old.map((b) => b._id) } })
}

export async function deleteBackupRecord(id: string): Promise<boolean> {
  const col = await backupsCol()
  const doc = await col.findOne({ _id: new ObjectId(id) })
  if (!doc) return false
  await del(doc.url).catch((e) => console.error('[backup] delete (blob) failed:', e))
  await col.deleteOne({ _id: doc._id })
  return true
}
