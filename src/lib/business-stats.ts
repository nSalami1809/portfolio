// Numbers behind the admin "Activité" dashboard: pipeline, conversion, cash,
// work in progress and what needs doing today. A pure function of the quotes,
// the invoices and the clock — no database, so it is unit-tested like the rest.
import type { Quote } from '@/actions/quotes'
import type { Invoice } from '@/lib/invoicing'
import type { PersonalInfo } from '@/types'
import { resolveTerms } from '@/lib/business'
import { addBusinessDays, RECETTE_DAYS } from '@/lib/quote-document'

const DAY = 86_400_000
const EXPIRING_SOON_DAYS = 3

interface Bucket { count: number; amount: number }

export interface ProjectRow {
  numero: string
  clientNom: string
  totalTTC: number
  // Planned delivery (in progress) or the date the recette is deemed accepted.
  dueAt: string
  late: boolean
}

export type TodoKind = 'issue_deposit' | 'issue_balance' | 'invoice_overdue' | 'quote_expiring' | 'recette_deemed'

export interface TodoItem {
  kind: TodoKind
  numero: string
  clientNom: string
  detail?: string
}

export interface BusinessStats {
  pipeline: { pending: Bucket; expired: Bucket; signed: Bucket; declined: Bucket }
  conversionRate: number | null
  avgDaysToSign: number | null
  cash: { billed: number; collected: number; outstanding: number; overdue: number; overdueCount: number }
  // Collected amounts (TTC) per month, oldest first, last 12 months.
  months: { key: string; collected: number }[]
  inProgress: ProjectRow[]
  awaitingRecette: ProjectRow[]
  todo: TodoItem[]
}

// A deposit is due on receipt: it only counts as late once the normal payment
// delay has gone by. A balance is late as soon as its due date has passed.
export function isInvoiceOverdue(inv: Pick<Invoice, 'status' | 'kind' | 'dueAt' | 'terms'>, now: number): boolean {
  if (inv.status !== 'issued') return false
  const grace = inv.kind === 'acompte' ? inv.terms.paymentDueDays * DAY : 0
  return now > new Date(inv.dueAt).getTime() + grace
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const add = (b: Bucket, amount: number) => { b.count++; b.amount += amount }

export function computeBusinessStats(quotes: Quote[], invoices: Invoice[], personal: PersonalInfo, now = new Date()): BusinessStats {
  const t = now.getTime()
  const pipeline = {
    pending: { count: 0, amount: 0 }, expired: { count: 0, amount: 0 }, signed: { count: 0, amount: 0 }, declined: { count: 0, amount: 0 },
  }
  const todo: TodoItem[] = []
  const inProgress: ProjectRow[] = []
  const awaitingRecette: ProjectRow[] = []
  const signDays: number[] = []
  const live = invoices.filter((i) => i.status !== 'cancelled')

  for (const q of quotes) {
    const expiresAt = new Date(q.dateEmission).getTime() + q.validiteJours * DAY
    const terms = resolveTerms(q, personal)

    if (q.kind === 'devis') {
      if (q.status === 'declined') add(pipeline.declined, q.totalTTC)
      else if (q.signature) {
        add(pipeline.signed, q.totalTTC)
        signDays.push((new Date(q.signature.signedAt).getTime() - new Date(q.dateEmission).getTime()) / DAY)
      } else if (t > expiresAt) add(pipeline.expired, q.totalTTC)
      else add(pipeline.pending, q.totalTTC)
    }

    if (q.status === 'pending' && !q.signature && expiresAt > t && expiresAt - t <= EXPIRING_SOON_DAYS * DAY) {
      todo.push({ kind: 'quote_expiring', numero: q.numero, clientNom: q.clientNom, detail: `expire le ${new Date(expiresAt).toLocaleDateString('fr-FR')}` })
    }

    if (q.status !== 'accepted' || !q.signature) continue

    const mine = live.filter((i) => i.quoteNumero === q.numero)
    const deposit = mine.find((i) => i.kind === 'acompte')
    const balance = mine.find((i) => i.kind === 'solde')
    const hasDeposit = terms.depositPercent > 0 && terms.depositPercent < 100

    if (hasDeposit && !deposit) todo.push({ kind: 'issue_deposit', numero: q.numero, clientNom: q.clientNom })

    if (!q.delivery) {
      // Development starts once the deposit is paid; without a deposit, at signature.
      const dueAt = addBusinessDays(q.signature.signedAt, terms.deliveryDays + (q.extraDelayDays ?? 0))
      inProgress.push({ numero: q.numero, clientNom: q.clientNom, totalTTC: q.totalTTC, dueAt: dueAt.toISOString(), late: t > dueAt.getTime() })
      continue
    }

    if (!balance && (!hasDeposit || deposit?.status === 'paid')) {
      todo.push({ kind: 'issue_balance', numero: q.numero, clientNom: q.clientNom })
    }
    if (!q.acceptance) {
      const deemedAt = addBusinessDays(q.delivery.deliveredAt, RECETTE_DAYS)
      const late = t >= deemedAt.getTime()
      awaitingRecette.push({ numero: q.numero, clientNom: q.clientNom, totalTTC: q.totalTTC, dueAt: deemedAt.toISOString(), late })
      if (late) todo.push({ kind: 'recette_deemed', numero: q.numero, clientNom: q.clientNom, detail: 'délai écoulé, réputée acceptée' })
    }
  }

  const cash = { billed: 0, collected: 0, outstanding: 0, overdue: 0, overdueCount: 0 }
  for (const inv of live) {
    cash.billed += inv.netToPay
    if (inv.status === 'paid') cash.collected += inv.netToPay
    else {
      cash.outstanding += inv.netToPay
      if (isInvoiceOverdue(inv, t)) {
        cash.overdue += inv.netToPay
        cash.overdueCount++
        todo.push({ kind: 'invoice_overdue', numero: inv.numero, clientNom: inv.client.nom, detail: `${inv.netToPay.toLocaleString('fr-FR')} FCFA` })
      }
    }
  }

  const monthTotals = new Map<string, number>()
  for (const inv of live) {
    if (inv.status !== 'paid' || !inv.payment) continue
    const key = monthKey(new Date(inv.payment.paidAt))
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + inv.netToPay)
  }
  const months: BusinessStats['months'] = []
  for (let i = 11; i >= 0; i--) {
    const key = monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1))
    months.push({ key, collected: monthTotals.get(key) ?? 0 })
  }

  const decided = pipeline.signed.count + pipeline.declined.count + pipeline.expired.count
  return {
    pipeline,
    conversionRate: decided > 0 ? Math.round((pipeline.signed.count / decided) * 100) : null,
    avgDaysToSign: signDays.length ? Math.round((signDays.reduce((a, b) => a + b, 0) / signDays.length) * 10) / 10 : null,
    cash,
    months,
    inProgress: inProgress.sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    awaitingRecette: awaitingRecette.sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    todo,
  }
}
