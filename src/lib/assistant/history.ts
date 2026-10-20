// Conversation history and the log of what the assistant did (which tools, when).
// Text only, with an expiry — the same approach as the public chatbot's log
// (lib/chat-log.ts): tool results, which carry site data, are never stored.
import type { UIMessage } from 'ai'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { RETENTION_DAYS } from '@/lib/chat-log-config'
import { isConversationId, toLogMessages, type ChatLogMessage } from '@/lib/chat-log'

export { isConversationId }

interface ConversationRecord { conversationId: string; messages: ChatLogMessage[]; createdAt: Date; updatedAt: Date; pinned?: boolean }
interface AuditRecord { at: Date; conversationId: string | null; tool: string; summary: string; ok: boolean; expiresAt: Date }

const MAX_TEXT = 8000
let indexes: Promise<unknown> | null = null

async function cols() {
  const db = await getDb()
  const conversations = db.collection<ConversationRecord>('assistant_conversations')
  const audit = db.collection<AuditRecord>('assistant_audit')
  if (!indexes) {
    indexes = Promise.all([
      conversations.createIndex({ conversationId: 1 }, { unique: true }),
      conversations.createIndex({ updatedAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86_400 }),
      audit.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((e) => console.error('[assistant] history indexes failed:', e))
  }
  return { conversations, audit }
}

export async function saveConversation(conversationId: string, messages: UIMessage[]): Promise<void> {
  try {
    const log = toLogMessages(messages, MAX_TEXT)
    if (log.length === 0) return
    const { conversations } = await cols()
    const now = new Date()
    await conversations.updateOne(
      { conversationId },
      { $set: { messages: log, updatedAt: now }, $setOnInsert: { conversationId, createdAt: now } },
      { upsert: true },
    )
  } catch (e) {
    console.error('[assistant] conversation save failed:', e)
  }
}

export interface ConversationDTO { id: string; conversationId: string; createdAt: string; updatedAt: string; messages: ChatLogMessage[]; pinned: boolean }

const toDto = (d: ConversationRecord & { _id: ObjectId }): ConversationDTO => ({
  id: d._id.toString(),
  conversationId: d.conversationId,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
  messages: d.messages,
  pinned: d.pinned === true,
})

export async function listConversations(limit = 40): Promise<ConversationDTO[]> {
  const { conversations } = await cols()
  const docs = await conversations.find({}).sort({ pinned: -1, updatedAt: -1 }).limit(limit).toArray()
  return docs.map(toDto)
}

/** Pinned conversations stay at the top of the list (they still expire with the retention period). */
export async function setConversationPinned(id: string, pinned: boolean): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const { conversations } = await cols()
  return (await conversations.updateOne({ _id: new ObjectId(id) }, { $set: { pinned } })).matchedCount === 1
}

export async function deleteConversation(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const { conversations } = await cols()
  return (await conversations.deleteOne({ _id: new ObjectId(id) })).deletedCount === 1
}

export interface ToolCallLog { tool: string; summary: string; ok: boolean }

export async function logToolCalls(conversationId: string | null, calls: ToolCallLog[]): Promise<void> {
  if (calls.length === 0) return
  try {
    const { audit } = await cols()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 180 * 86_400_000)
    await audit.insertMany(calls.map((c) => ({ at: now, conversationId, tool: c.tool, summary: c.summary.slice(0, 240), ok: c.ok, expiresAt })))
  } catch (e) {
    console.error('[assistant] audit log failed:', e)
  }
}
