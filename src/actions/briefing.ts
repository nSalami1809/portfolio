'use server'

import { requireAdmin } from '@/lib/require-admin'
import { loadBriefingInputs } from '@/lib/briefing-data'
import { buildBriefing, type Briefing } from '@/lib/briefing'

// "À traiter aujourd'hui" for the administrator, with client references. Computed
// by the code from existing data: no model call, nothing sent anywhere.
export async function getDailyBriefing(): Promise<Briefing> {
  await requireAdmin()
  return buildBriefing(await loadBriefingInputs(), { includeNames: true })
}
