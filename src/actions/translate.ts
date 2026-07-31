'use server'

import { translateFields } from '@/lib/translate'

// Thin client-callable wrapper — the actual Gemini call + Mongo cache lives in
// src/lib/translate.ts (server-only: crypto, MongoDB, the AI SDK).
export async function translateText(
  key: string,
  locale: string,
  fields: Record<string, string>,
): Promise<Record<string, string>> {
  return translateFields(key, locale, fields)
}
