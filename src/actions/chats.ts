'use server'

import { ObjectId } from 'mongodb'
import { requireAdmin } from '@/lib/require-admin'
import { chatLogCol, feedbackKey, type ChatLogMessage } from '@/lib/chat-log'
import { triageChat, type ChatThumb, type ChatTriage } from '@/lib/chat-triage'
import { readInstantStats, type InstantStats } from '@/lib/chat-instant-stats'

export interface AdminChat {
  id: string
  locale: 'fr' | 'en'
  createdAt: string
  updatedAt: string
  read: boolean
  messages: ChatLogMessage[]
  /** What the visitor wanted, lead signal, unanswered flag: computed by rules, see lib/chat-triage.ts. */
  triage: ChatTriage
  /** The visitor's thumb on each message (null: none), same order as `messages`. */
  ratings: (ChatThumb | null)[]
}

export async function listChats(): Promise<AdminChat[]> {
  await requireAdmin()
  const col = await chatLogCol()
  const docs = await col.find({}).sort({ updatedAt: -1 }).limit(200).toArray()
  return docs.map((d) => {
    const ratings = d.messages.map((m) => (m.role === 'assistant' ? d.feedback?.[feedbackKey(m.text)] ?? null : null))
    return {
    id: d._id.toString(),
    locale: d.locale,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    read: d.read,
    messages: d.messages,
    triage: triageChat(d.messages, ratings),
    ratings,
    }
  })
}

/** Visitor questions answered by the rules instead of the model: free-tier requests not spent. */
export async function getInstantStats(): Promise<InstantStats> {
  await requireAdmin()
  return readInstantStats()
}

export async function markChatRead(id: string): Promise<void> {
  await requireAdmin()
  const col = await chatLogCol()
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { read: true } })
}

export async function deleteChat(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  const col = await chatLogCol()
  const result = await col.deleteOne({ _id: new ObjectId(id) })
  return { ok: result.deletedCount === 1 }
}
