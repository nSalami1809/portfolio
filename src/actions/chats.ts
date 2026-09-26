'use server'

import { ObjectId } from 'mongodb'
import { requireAdmin } from '@/lib/require-admin'
import { chatLogCol, type ChatLogMessage } from '@/lib/chat-log'

export interface AdminChat {
  id: string
  locale: 'fr' | 'en'
  createdAt: string
  updatedAt: string
  read: boolean
  messages: ChatLogMessage[]
}

export async function listChats(): Promise<AdminChat[]> {
  await requireAdmin()
  const col = await chatLogCol()
  const docs = await col.find({}).sort({ updatedAt: -1 }).limit(200).toArray()
  return docs.map((d) => ({
    id: d._id.toString(),
    locale: d.locale,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    read: d.read,
    messages: d.messages,
  }))
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
