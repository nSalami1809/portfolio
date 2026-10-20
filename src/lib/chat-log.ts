// Chatbot conversations kept for the admin (to see what visitors really ask,
// and to follow up on a lead). Deliberately lean: only the *text* of the
// exchanges is stored — never the tool results, which carry whole quotes with
// personal data — capped in size, tied to an anonymous id generated in the
// visitor's browser, and deleted automatically after RETENTION_DAYS (TTL
// index). The privacy policy says exactly this.
import { createHash } from 'node:crypto'
import type { UIMessage } from 'ai'
import { getDb } from '@/lib/mongodb'
import { RETENTION_DAYS } from '@/lib/chat-log-config'
import { CHAT_TAG_LABEL, leadSignals, shouldAlertLead, triageChat } from '@/lib/chat-triage'
import { notifyAdmin } from '@/lib/push'

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
  /** The visitor's thumbs on the assistant's answers, keyed by feedbackKey(answer text). */
  feedback?: Record<string, ChatRating>
  /** The admin was alerted that this conversation left a way to reach the visitor (once). */
  leadNotified?: boolean
}

export type ChatRating = 'up' | 'down'

/**
 * Stable key of an assistant answer: its text without the tool markers, whitespace
 * collapsed, lowercased. The browser and the server derive it the same way, so a thumb
 * can be matched to the answer it was given to without storing any id per message.
 */
export function feedbackKey(text: string): string {
  const norm = text.replace(/^\[[A-Za-z]+\]$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 400)
  return createHash('sha1').update(norm).digest('hex').slice(0, 16)
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
export function toLogMessages(messages: UIMessage[], maxText: number = MAX_TEXT): ChatLogMessage[] {
  const out: ChatLogMessage[] = []
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    const parts: string[] = []
    for (const p of m.parts) {
      if (p.type === 'text' && p.text.trim()) parts.push(p.text.trim())
      else if (p.type.startsWith('tool-')) parts.push(`[${p.type.slice(5)}]`)
    }
    const text = parts.join('\n').slice(0, maxText)
    if (text) out.push({ role: m.role, text })
  }
  return out.slice(-MAX_MESSAGES)
}

/**
 * Records the visitor's thumb on one of the answers of THEIR conversation. Refuses an
 * answer that is not in it, so the stored keys can never outgrow the conversation.
 * A thumb down marks the conversation unread so it surfaces for the admin.
 */
export async function saveChatFeedback(conversationId: string, answerText: string, rating: ChatRating | 'none'): Promise<boolean> {
  const col = await chatLogCol()
  const doc = await col.findOne({ conversationId }, { projection: { messages: 1 } })
  if (!doc) return false
  const key = feedbackKey(answerText)
  if (!doc.messages.some((m) => m.role === 'assistant' && feedbackKey(m.text) === key)) return false
  const update = rating === 'none'
    ? { $unset: { [`feedback.${key}`]: '' as const } }
    : { $set: { [`feedback.${key}`]: rating, ...(rating === 'down' ? { read: false } : {}) } }
  const r = await col.updateOne({ conversationId }, update)
  return r.matchedCount === 1
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
    await alertIfNewLead(col, conversationId, log)
  } catch (e) {
    console.error('[chat-log] save failed:', e)
  }
}

/**
 * Once per conversation, a push notification when the visitor leaves a way to reach
 * them or gets a quote: the lead is seen now, not at the next visit to the dashboard.
 * Bookings and "talk to a human" requests alert on their own, so they are not doubled.
 * The conversation is claimed atomically first, so two saves racing send one alert.
 */
async function alertIfNewLead(col: Awaited<ReturnType<typeof chatLogCol>>, conversationId: string, log: ChatLogMessage[]): Promise<void> {
  if (!shouldAlertLead(leadSignals(log))) return
  const claimed = await col.findOneAndUpdate({ conversationId, leadNotified: { $ne: true } }, { $set: { leadNotified: true } })
  if (!claimed) return
  const t = triageChat(log)
  await notifyAdmin({ title: 'Contact possible dans le chatbot', body: `${CHAT_TAG_LABEL[t.tag]} : ${t.summary}`, url: '/admin/chats' })
}

// For the admin assistant's analysis: the text of the most recent exchanges, newest
// first. Read-only; personal data is stripped by the caller before anything is sent
// to a model.
export async function recentChatTranscripts(limit: number): Promise<ChatLogMessage[][]> {
  const col = await chatLogCol()
  const docs = await col.find({}).sort({ updatedAt: -1 }).limit(Math.max(1, Math.min(limit, 100))).toArray()
  return docs.map((d) => d.messages)
}
