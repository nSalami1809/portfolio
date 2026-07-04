'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/mongodb'
import type { PortfolioData } from '@/types'

const DOC_ID = 'main'

export async function publishPortfolio(data: PortfolioData): Promise<void> {
  const db = await getDb()
  await db.collection('portfolio').updateOne(
    { _id: DOC_ID as unknown as never },
    { $set: { ...data, _id: DOC_ID as unknown as never, updatedAt: new Date() } },
    { upsert: true },
  )
  // Bust the ISR cache so the home page reflects changes immediately
  revalidatePath('/')
}

export async function fetchPortfolio(): Promise<PortfolioData | null> {
  const db = await getDb()
  const doc = await db.collection('portfolio').findOne({ _id: DOC_ID as unknown as never })
  if (!doc) return null
  const { _id: _docId, updatedAt: _updatedAt, ...data } = doc
  return data as PortfolioData
}
