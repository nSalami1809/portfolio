'use server'

import { requireAdmin } from '@/lib/require-admin'
import { getStatus, handleProviderError, preflight, releaseLock, type AssistantStatus } from '@/lib/assistant/guard'
import { createDraft, discardDraft, getDraft, listDrafts, markDraftSent, reviseDraft, updateEmailDraftText } from '@/lib/assistant/draft-store'
import { cleanEmailText, planReminder, reminderHistory, type ReminderHistoryEntry } from '@/lib/assistant/reminders'
import { loadQuotesForReminders, QUOTE_SITE_URL } from '@/lib/assistant-quotes-data'
import { fetchPortfolioFresh } from '@/lib/portfolio-data'
import { deleteConversation, listConversations, setConversationPinned, type ConversationDTO } from '@/lib/assistant/history'
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

export type PrepareReminderResult =
  | { ok: true; draftId: string; hasEmail: boolean; tone: string; warning?: string }
  | { ok: false; error: string }

/**
 * "Prepare the reminder" from the quotes pipeline: the same draft the assistant would write
 * (same tone, same warning, same draft updated), built by the code from the real quote.
 * No model request, nothing sent: the admin reads it in the drafts panel and sends it.
 */
export async function prepareQuoteReminder(numero: string): Promise<PrepareReminderResult> {
  await requireAdmin()
  if (typeof numero !== 'string' || !/^[A-Z]{3}-\d{4}-\d{3,5}$/i.test(numero.trim())) return { ok: false, error: 'Numéro de devis invalide.' }
  const quote = (await loadQuotesForReminders(100)).find((q) => q.numero.toUpperCase() === numero.trim().toUpperCase())
  if (!quote) return { ok: false, error: "Ce devis n'attend plus de réponse." }
  const data = await fetchPortfolioFresh()
  const plan = planReminder(quote, await listDrafts({ limit: 100 }), { now: new Date(), adminName: data?.personal.name ?? '', siteUrl: QUOTE_SITE_URL })
  const result = (draftId: string): PrepareReminderResult => ({ ok: true, draftId, hasEmail: Boolean(plan.payload.to), tone: plan.tone, ...(plan.warning ? { warning: plan.warning } : {}) })
  if (plan.existing) {
    const revised = await reviseDraft(plan.existing.id, plan.existing.version, { payload: plan.payload, note: 'Relance régénérée' })
    if (revised.ok) return result(revised.draft.id)
  }
  const draft = await createDraft({ kind: 'email_reminder', title: `Relance ${quote.numero}`, payload: plan.payload })
  return result(draft.id)
}

/** Reminders marked as sent, per quote number (for the pipeline's "last reminded" line). */
export async function getQuoteReminderHistory(): Promise<Record<string, ReminderHistoryEntry>> {
  await requireAdmin()
  return Object.fromEntries(reminderHistory(await listDrafts({ limit: 100 })))
}

/** Auto-save of the admin's edits to a reminder e-mail (subject and text). */
export async function saveReminderText(id: string, subject: string, body: string): Promise<{ ok: true; savedAt: string } | { ok: false; error: string }> {
  await requireAdmin()
  const text = cleanEmailText({ subject, body })
  if (!text) return { ok: false, error: "L'objet et le message ne peuvent pas être vides." }
  const draft = await updateEmailDraftText(id, text)
  return draft ? { ok: true, savedAt: draft.updatedAt } : { ok: false, error: 'Brouillon introuvable ou déjà écarté.' }
}

/** The admin sent a reminder e-mail from their own mail app: note it (or take the note back). */
export async function markReminderSent(id: string, sent: boolean): Promise<{ ok: true; draft: DraftDTO } | { ok: false; error: string }> {
  await requireAdmin()
  const draft = await markDraftSent(id, sent === true)
  return draft ? { ok: true, draft } : { ok: false, error: 'Brouillon introuvable ou déjà écarté.' }
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

export async function pinAssistantConversation(id: string, pinned: boolean): Promise<{ ok: boolean }> {
  await requireAdmin()
  return { ok: await setConversationPinned(id, pinned === true) }
}

export async function deleteAssistantConversation(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  return { ok: await deleteConversation(id) }
}
