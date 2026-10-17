'use server'

import { requireAdmin } from '@/lib/require-admin'
import { getStatus, handleProviderError, preflight, releaseLock, type AssistantStatus } from '@/lib/assistant/guard'
import { discardDraft, getDraft, listDrafts, reviseDraft } from '@/lib/assistant/draft-store'
import { deleteConversation, listConversations, type ConversationDTO } from '@/lib/assistant/history'
import { blogFieldsSchema, type BlogPayload, type DraftDTO, type PatchPayload } from '@/lib/assistant/drafts'
import { translateFields } from '@/lib/assistant/draft-generation'
import { assistantProviderOptions, getChatModel } from '@/lib/assistant/models'

// Back-office side of the assistant: its status, its drafts, its history. Every
// action checks the admin session first (Server Actions are reachable by direct
// POST). None of them can touch site data: they read and write assistant_*
// collections only; the one that calls the model (English regeneration) goes
// through the same limits as the chat.

export async function getAssistantStatus(): Promise<AssistantStatus> {
  await requireAdmin()
  return getStatus()
}

export async function listAssistantDrafts(): Promise<DraftDTO[]> {
  await requireAdmin()
  return listDrafts({ limit: 40 })
}

export async function getAssistantDraft(id: string): Promise<DraftDTO | null> {
  await requireAdmin()
  return getDraft(id)
}

export async function discardAssistantDraft(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  return { ok: await discardDraft(id) }
}

export type RegenerateResult = { ok: true; draft: DraftDTO } | { ok: false; error: string }

/** Re-runs the English version of a draft (one request of the free quota). */
export async function regenerateDraftEnglish(id: string): Promise<RegenerateResult> {
  await requireAdmin()
  const draft = await getDraft(id)
  if (!draft || draft.status !== 'draft') return { ok: false, error: 'Brouillon introuvable.' }
  if (draft.kind === 'email_reminder') return { ok: false, error: "Ce brouillon est un e-mail : il n'a pas de version anglaise à générer." }

  const gate = await preflight()
  if (!gate.ok) return { ok: false, error: gate.message }
  try {
    // Translating is a chat-model job; the request is counted by the limiter around the model.
    const model = getChatModel()
    const env = { model, writerModel: model, providerOptions: assistantProviderOptions, maxDraftTokens: gate.limits.maxDraftTokens }

    if (draft.kind === 'blog_post') {
      const payload = draft.payload as BlogPayload
      const parsed = blogFieldsSchema.safeParse(await translateFields(env, { title: payload.fr.title, excerpt: payload.fr.excerpt, content: payload.fr.content }))
      if (!parsed.success) return { ok: false, error: 'La traduction générée est invalide. Réessayez.' }
      const next: BlogPayload = { ...payload, en: parsed.data }
      delete next.enError
      const r = await reviseDraft(id, draft.version, { payload: next, note: 'Anglais régénéré' })
      return r.ok ? { ok: true, draft: r.draft } : { ok: false, error: 'Le brouillon a changé entre-temps. Rechargez-le.' }
    }

    const payload = draft.payload as PatchPayload
    const afterEn = (await translateFields(env, { text: payload.after })).text
    if (!afterEn) return { ok: false, error: 'La traduction générée est vide. Réessayez.' }
    const next: PatchPayload = { ...payload, afterEn }
    delete next.enError
    const r = await reviseDraft(id, draft.version, { payload: next, note: 'Anglais régénéré' })
    return r.ok ? { ok: true, draft: r.draft } : { ok: false, error: 'Le brouillon a changé entre-temps. Rechargez-le.' }
  } catch (err) {
    const classified = await handleProviderError(err)
    return { ok: false, error: classified.message }
  } finally {
    await releaseLock()
  }
}

export async function listAssistantConversations(): Promise<ConversationDTO[]> {
  await requireAdmin()
  return listConversations()
}

export async function deleteAssistantConversation(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  return { ok: await deleteConversation(id) }
}
