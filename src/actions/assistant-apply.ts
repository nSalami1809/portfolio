'use server'

import { updateTag } from 'next/cache'
import { requireAdmin } from '@/lib/require-admin'
import { readPortfolioWithVersion } from '@/lib/portfolio-data'
import { replacePortfolioKey } from '@/lib/portfolio-write'
import { seedTranslation } from '@/lib/translate'
import { getDraft, markDraftApplied, markDraftUnapplied } from '@/lib/assistant/draft-store'
import { getApplied, journalApplied, markUndone } from '@/lib/draft-apply-store'
import { applyDraft, undoDraft, type ApplyErrorCode, type ApplyOptions } from '@/lib/draft-apply'
import type { DraftDTO } from '@/lib/assistant/drafts'

// The only door through which an assistant draft can change the site. It exists
// for the administrator's "Appliquer" button: the assistant's tools cannot reach
// this file (tests/assistant-tools.test.ts), and nothing runs without an explicit
// click and a confirmation in the page.

export type ApplyActionResult =
  | { ok: true; summary: string; published: boolean; warnings: string[]; draft: DraftDTO | null }
  | { ok: false; code: ApplyErrorCode; error: string }

function refreshPublicSite() {
  // Immediate expiry of everything tagged 'portfolio', like publishPortfolio does.
  try {
    updateTag('portfolio')
  } catch (err) {
    console.error('assistant-apply: updateTag failed, relying on the 30s cache fallback', err)
  }
}

export async function applyAssistantDraft(id: string, options: ApplyOptions): Promise<ApplyActionResult> {
  await requireAdmin()
  const draft = await getDraft(id)
  if (!draft) return { ok: false, code: 'not_found', error: 'Brouillon introuvable.' }
  const opts: ApplyOptions = { publish: options?.publish === true, includeEnglish: options?.includeEnglish === true, acknowledgeClaims: options?.acknowledgeClaims === true }

  const outcome = await applyDraft(
    {
      read: readPortfolioWithVersion,
      replaceKey: (key, value, version) => replacePortfolioKey(key, value, version),
      seedTranslation: (seed) => seedTranslation(seed.key, 'en', seed.source, seed.translated),
      journal: journalApplied,
      markApplied: markDraftApplied,
      now: () => new Date(),
    },
    draft,
    opts,
  )
  if (!outcome.ok) return outcome
  refreshPublicSite()
  return { ...outcome, draft: await getDraft(id) }
}

export async function undoAssistantDraft(id: string): Promise<ApplyActionResult> {
  await requireAdmin()
  const outcome = await undoDraft(
    {
      read: readPortfolioWithVersion,
      replaceKey: (key, value, version) => replacePortfolioKey(key, value, version),
      getApplied,
      markUndone,
      markUnapplied: markDraftUnapplied,
    },
    id,
  )
  if (!outcome.ok) return outcome
  refreshPublicSite()
  return { ok: true, summary: outcome.summary, published: false, warnings: [], draft: await getDraft(id) }
}
