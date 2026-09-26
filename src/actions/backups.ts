'use server'

import { requireAdmin } from '@/lib/require-admin'
import { backupsCol, backupConfigured, createBackup, deleteBackupRecord, KEEP_BACKUPS } from '@/lib/backup'

export interface AdminBackup {
  id: string
  url: string
  size: number
  createdAt: string
  collections: Record<string, number>
}

export async function listBackups(): Promise<{ configured: boolean; keep: number; backups: AdminBackup[] }> {
  await requireAdmin()
  const col = await backupsCol()
  const docs = await col.find({}).sort({ createdAt: -1 }).toArray()
  return {
    configured: backupConfigured(),
    keep: KEEP_BACKUPS,
    backups: docs.map((d) => ({ id: d._id.toString(), url: d.url, size: d.size, createdAt: d.createdAt.toISOString(), collections: d.collections })),
  }
}

export async function runBackupNow(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin()
  const result = await createBackup()
  if (!result.ok) return { ok: false, message: result.error }
  const total = Object.values(result.record.collections).reduce((a, b) => a + b, 0)
  return { ok: true, message: `Sauvegarde créée (${total} documents).` }
}

export async function deleteBackup(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  return { ok: await deleteBackupRecord(id) }
}
