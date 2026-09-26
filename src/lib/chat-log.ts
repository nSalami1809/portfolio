// Chatbot conversations kept for the admin (to see what visitors really ask,
// and to follow up on a lead). Deliberately lean: only the *text* of the
// exchanges is stored — never the tool results, which carry whole quotes with
// personal data — capped in size, tied to an anonymous id generated in the
// visitor's browser, and deleted automatically after RETENTION_DAYS (TTL
// index). The privacy policy says exactly this.
import type { UIMessage } from 'ai'
import { getDb } from '@/lib/mongodb'
import { RETENTION_DAYS } from '@/lib/chat-log-config'

const MAX_MESSAGES = 60
const MAX_TEXT = 2000

export interface ChatLogMessage {
  role: 'user' | 'assistant'
  text: string
}

export interface ChatConversationRecord {
  conversationId: string
  locale: 'fr' | 'en'
  messages: ChatLogMessage[]
  createdAt: Date
  updatedAt: Date
  read: boolean
}

export const isConversationId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(v)

let indexes: Promise<unknown> | null = null
export async function chatLogCol() {
  const db = await getDb()
  const col = db.collection<ChatConversationRecord>('chat_conversations')
  if (!indexes) {
    indexes = Promise.all([
      col.createIndex({ conversationId: 1 }, { unique: true }),
      col.createIndex({ updatedAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86_400 }),
    ]).catch((e) => console.error('[chat-log] index creation failed:', e))
  }
  return col
}

// Text of the exchange, with a short marker where the assistant used a tool
// (so the admin sees "a quote was generated" without the quote itself).
export function toLogMessages(messages: UIMessage[]): ChatLogMessage[] {
  const out: ChatLogMessage[] = []
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    const parts: string[] = []
    for (const p of m.parts) {
      if (p.type === 'text' && p.text.trim()) parts.push(p.text.trim())
      else if (p.type.startsWith('tool-')) parts.push(`[${p.type.slice(5)}]`)
    }
    const text = parts.join('\n').slice(0, MAX_TEXT)
    if (text) out.push({ role: m.role, text })
  }
  return out.slice(-MAX_MESSAGES)
}

export async function saveChatConversation(conversationId: string, locale: string, messages: UIMessage[]): Promise<void> {
  try {
    if (process.env.E2E_DRY_RUN === '1') return
    const log = toLogMessages(messages)
    if (log.length === 0) return
    const col = await chatLogCol()
    const now = new Date()
    await col.updateOne(
      { conversationId },
      {
        $set: { messages: log, updatedAt: now, locale: locale === 'en' ? 'en' : 'fr', read: false },
        $setOnInsert: { conversationId, createdAt: now },
      },
      { upsert: true },
    )
  } catch (e) {
    console.error('[chat-log] save failed:', e)
  }
}
