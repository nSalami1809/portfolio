// Persistence of the assistant's drafts. Its own collection, never the portfolio
// document: a draft is invisible to the site until a human copies it over.
import { ObjectId, type WithId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { MAX_VERSIONS, type DraftDTO, type DraftKind, type DraftPayload } from '@/lib/assistant/drafts'

interface VersionRecord { n: number; at: Date; note: string; payload: DraftPayload }
interface DraftRecord {
  kind: DraftKind
  title: string
  status: 'draft' | 'discarded'
  version: number
  createdAt: Date
  updatedAt: Date
  conversationId: string | null
  unverifiedClaims: string[]
  baseHash: string | null
  payload: DraftPayload
  versions: VersionRecord[]
}

const COLLECTION = 'assistant_drafts'
let indexes: Promise<unknown> | null = null

async function col() {
  const db = await getDb()
  const c = db.collection<DraftRecord>(COLLECTION)
  if (!indexes) indexes = c.createIndex({ updatedAt: -1 }).catch((e) => console.error('[assistant] drafts index failed:', e))
  return c
}

function toDTO(doc: WithId<DraftRecord>): DraftDTO {
  const previous = doc.versions.length >= 2 ? doc.versions[doc.versions.length - 2].payload : null
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    title: doc.title,
    status: doc.status,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    conversationId: doc.conversationId,
    unverifiedClaims: doc.unverifiedClaims,
    baseHash: doc.baseHash,
    payload: doc.payload,
    previousPayload: previous,
    versions: doc.versions.map((v) => ({ n: v.n, at: v.at.toISOString(), note: v.note })),
  }
}

export interface NewDraft {
  kind: DraftKind
  title: string
  payload: DraftPayload
  conversationId?: string | null
  unverifiedClaims?: string[]
  baseHash?: string | null
}

export async function createDraft(input: NewDraft): Promise<DraftDTO> {
  const c = await col()
  const now = new Date()
  const record: DraftRecord = {
    kind: input.kind,
    title: input.title,
    status: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
    conversationId: input.conversationId ?? null,
    unverifiedClaims: input.unverifiedClaims ?? [],
    baseHash: input.baseHash ?? null,
    payload: input.payload,
    versions: [{ n: 1, at: now, note: 'Création', payload: input.payload }],
  }
  const { insertedId } = await c.insertOne(record)
  return toDTO({ ...record, _id: insertedId })
}

export async function listDrafts(opts: { includeDiscarded?: boolean; limit?: number } = {}): Promise<DraftDTO[]> {
  const c = await col()
  const docs = await c
    .find(opts.includeDiscarded ? {} : { status: 'draft' })
    .sort({ updatedAt: -1 })
    .limit(Math.min(opts.limit ?? 30, 100))
    .toArray()
  return docs.map(toDTO)
}

export async function getDraft(id: string): Promise<DraftDTO | null> {
  if (!ObjectId.isValid(id)) return null
  const c = await col()
  const doc = await c.findOne({ _id: new ObjectId(id) })
  return doc ? toDTO(doc) : null
}

export type ReviseResult = { ok: true; draft: DraftDTO } | { ok: false; reason: 'not_found' | 'conflict' | 'discarded' }

/**
 * Stores a new version of a draft. `expectedVersion` makes it safe against two
 * revisions racing: the loser gets `conflict` instead of silently overwriting.
 */
export async function reviseDraft(
  id: string,
  expectedVersion: number,
  patch: { payload: DraftPayload; title?: string; unverifiedClaims?: string[]; note: string },
): Promise<ReviseResult> {
  if (!ObjectId.isValid(id)) return { ok: false, reason: 'not_found' }
  const c = await col()
  const now = new Date()
  const next = expectedVersion + 1
  const updated = await c.findOneAndUpdate(
    { _id: new ObjectId(id), version: expectedVersion, status: 'draft' },
    {
      $set: {
        payload: patch.payload,
        updatedAt: now,
        version: next,
        ...(patch.title ? { title: patch.title } : {}),
        ...(patch.unverifiedClaims ? { unverifiedClaims: patch.unverifiedClaims } : {}),
      },
      $push: { versions: { $each: [{ n: next, at: now, note: patch.note, payload: patch.payload }], $slice: -MAX_VERSIONS } },
    },
    { returnDocument: 'after' },
  )
  if (updated) return { ok: true, draft: toDTO(updated) }
  const existing = await c.findOne({ _id: new ObjectId(id) })
  if (!existing) return { ok: false, reason: 'not_found' }
  return { ok: false, reason: existing.status === 'discarded' ? 'discarded' : 'conflict' }
}

export async function discardDraft(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const c = await col()
  const r = await c.updateOne({ _id: new ObjectId(id), status: 'draft' }, { $set: { status: 'discarded', updatedAt: new Date() } })
  return r.matchedCount === 1
}
