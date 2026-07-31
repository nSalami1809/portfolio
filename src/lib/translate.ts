import { createHash } from 'crypto'
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { getDb } from './mongodb'

interface TranslationRecord {
  key: string
  locale: string
  hash: string
  fields: Record<string, string>
  createdAt: Date
}

function hashFields(fields: Record<string, string>): string {
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex')
}

// Translates a flat set of French string fields (project/blog post content)
// to the target locale, using the same Gemini model as the chatbot. Results
// are cached in MongoDB keyed by content + a hash of the source text, so
// editing the French content in the admin automatically invalidates the
// stale English cache on next view. Falls back to the French fields on any
// failure — a translation hiccup must never break the page.
export async function translateFields<T extends Record<string, string>>(
  key: string,
  locale: string,
  fields: T,
): Promise<T> {
  if (locale === 'fr') return fields

  const entries = Object.entries(fields).filter(([, v]) => v && v.trim())
  if (entries.length === 0) return fields

  const hash = hashFields(fields)
  const db = await getDb()
  const col = db.collection<TranslationRecord>('translations')

  const cached = await col.findOne({ key, locale, hash })
  if (cached) return { ...fields, ...cached.fields } as T

  try {
    const shape = Object.fromEntries(entries.map(([k]) => [k, z.string()]))
    const { object } = await generateObject({
      model: google('gemini-3.5-flash-lite'),
      schema: z.object(shape),
      prompt: `Translate each of the following French text fields to natural, professional English. Preserve any Markdown formatting, line breaks, and technical/product names as-is. Return a translation for every field.\n\n${JSON.stringify(Object.fromEntries(entries), null, 2)}`,
    })

    await col.updateOne(
      { key, locale, hash },
      { $set: { key, locale, hash, fields: object, createdAt: new Date() } },
      { upsert: true },
    )

    return { ...fields, ...object } as T
  } catch (e) {
    console.error(`[translateFields] failed for key="${key}":`, e)
    return fields
  }
}
