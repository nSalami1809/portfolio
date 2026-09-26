'use server'

import { requireAdmin } from '@/lib/require-admin'
import { quotesCol, toQuote } from '@/lib/quotes-core'
import { invoicesCol, toInvoice } from '@/lib/invoicing'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { computeBusinessStats, type BusinessStats } from '@/lib/business-stats'

// Everything the admin "Activité" dashboard shows, computed on the server so
// the browser receives a handful of numbers, not every quote and invoice.
export async function getBusinessStats(): Promise<BusinessStats> {
  await requireAdmin()
  const [qcol, icol, portfolio] = await Promise.all([quotesCol(), invoicesCol(), fetchPortfolioSafe('business-stats')])
  const [quoteDocs, invoiceDocs] = await Promise.all([
    qcol.find({}).sort({ createdAt: -1 }).limit(1000).toArray(),
    icol.find({}).sort({ issuedAt: -1 }).limit(1000).toArray(),
  ])
  return computeBusinessStats(quoteDocs.map(toQuote), invoiceDocs.map(toInvoice), portfolio?.personal ?? defaultPersonalInfo)
}
