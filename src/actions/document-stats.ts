'use server'

import { requireAdmin } from '@/lib/require-admin'
import { getDocumentDownloads, type DocumentDownloads } from '@/lib/document-downloads'

// Per-document downloads for the admin documents list (what the views are for the blog list).
export async function getDocumentDownloadCounts(): Promise<Record<string, DocumentDownloads>> {
  await requireAdmin()
  return getDocumentDownloads()
}
