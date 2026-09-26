'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listInvoices, downloadInvoicePdf, type Invoice } from '@/actions/billing'
import { useToast } from '@/components/admin/Toast'
import { saveBase64Pdf } from '@/lib/browser-download'

type Filter = 'all' | 'due' | 'overdue' | 'paid' | 'cancelled'

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const DAY = 86_400_000

// A deposit is due on receipt: it only counts as late once the normal payment
// delay has gone by. A balance is late as soon as its due date has passed.
function isOverdue(inv: Invoice, now: number): boolean {
  if (inv.status !== 'issued') return false
  const grace = inv.kind === 'acompte' ? inv.terms.paymentDueDays * DAY : 0
  return now > new Date(inv.dueAt).getTime() + grace
}

const STATUS: Record<Invoice['status'], { label: string; color: string }> = {
  issued: { label: 'À payer', color: '#E45742' },
  paid: { label: 'Payée', color: '#008000' },
  cancelled: { label: 'Annulée', color: 'var(--text-subtle)' },
}

function csvCell(v: string | number) {
  const s = String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Every invoice at a glance: what is billed, collected, still to collect, and
// what is late — with a CSV export for the accountant.
export default function AdminInvoices() {
  const toast = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  // Captured once per load: keeps rendering pure (no clock read during render).
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    try {
      setInvoices(await listInvoices())
      setNow(Date.now())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => {
    const live = invoices.filter((i) => i.status !== 'cancelled')
    return {
      billed: live.reduce((s, i) => s + i.netToPay, 0),
      collected: live.filter((i) => i.status === 'paid').reduce((s, i) => s + i.netToPay, 0),
      toCollect: live.filter((i) => i.status === 'issued').reduce((s, i) => s + i.netToPay, 0),
      overdue: live.filter((i) => isOverdue(i, now)).reduce((s, i) => s + i.netToPay, 0),
      overdueCount: live.filter((i) => isOverdue(i, now)).length,
    }
  }, [invoices, now])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter((i) => {
      if (filter === 'due' && i.status !== 'issued') return false
      if (filter === 'overdue' && !isOverdue(i, now)) return false
      if (filter === 'paid' && i.status !== 'paid') return false
      if (filter === 'cancelled' && i.status !== 'cancelled') return false
      if (!q) return true
      return [i.numero, i.quoteNumero, i.client.nom, i.client.societe ?? '', i.client.email ?? '', i.payment?.receiptNumero ?? '']
        .some((v) => v.toLowerCase().includes(q))
    })
  }, [invoices, filter, search, now])

  const download = async (inv: Invoice, document: 'facture' | 'recu') => {
    const key = `${document}-${inv.id}`
    setBusy(key)
    try {
      const result = await downloadInvoicePdf(inv.id, document)
      if (result.ok) saveBase64Pdf(result.base64, result.filename)
      else toast(result.error, 'error')
    } catch {
      toast('Une erreur est survenue.', 'error')
    } finally { setBusy(null) }
  }

  const exportCsv = () => {
    const header = ['Numéro', 'Type', 'Statut', 'Devis', 'Client', 'Société', 'Émise le', 'Échéance', 'HT', 'TVA', 'TTC', 'Net à payer', 'Payée le', 'Moyen', 'Reçu']
    const rows = filtered.map((i) => [
      i.numero, i.kind === 'acompte' ? 'Acompte' : 'Solde', STATUS[i.status].label, i.quoteNumero, i.client.nom, i.client.societe ?? '',
      i.issuedAt.slice(0, 10), i.dueAt.slice(0, 10), i.totalHT, i.tva, i.totalTTC, i.netToPay,
      i.payment?.paidAt.slice(0, 10) ?? '', i.payment?.method ?? '', i.payment?.receiptNumero ?? '',
    ])
    const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `factures-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const TABS: { id: Filter; label: string }[] = [
    { id: 'all', label: `Toutes (${invoices.length})` },
    { id: 'due', label: `À payer (${invoices.filter((i) => i.status === 'issued').length})` },
    { id: 'overdue', label: `En retard (${totals.overdueCount})` },
    { id: 'paid', label: 'Payées' },
    { id: 'cancelled', label: 'Annulées' },
  ]

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>Factures</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Émises depuis le panneau de chaque devis. Ici : la vue d&apos;ensemble et l&apos;export.
          </p>
        </div>
        <button className="btn-secondary btn-sm" onClick={exportCsv} disabled={filtered.length === 0}>Exporter en CSV</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Facturé', value: fmt(totals.billed), color: 'var(--text)' },
          { label: 'Encaissé', value: fmt(totals.collected), color: '#008000' },
          { label: 'À encaisser', value: fmt(totals.toCollect), color: '#E45742' },
          { label: 'En retard', value: fmt(totals.overdue), color: totals.overdue > 0 ? '#D90000' : 'var(--text)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card no-lift p-4 text-center">
            <p className="text-lg font-display font-bold truncate" style={{ color }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-0 mb-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className="px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap"
            style={{
              fontFamily: 'var(--font-poppins)',
              color: filter === id ? 'var(--text)' : 'var(--text-subtle)',
              borderBottom: filter === id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        className="input mb-4"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher : numéro, client, société, email, devis…"
        aria-label="Rechercher une facture"
      />

      {loading ? (
        <div className="card no-lift p-4 animate-pulse" style={{ height: 72 }} />
      ) : filtered.length === 0 ? (
        <div className="card no-lift p-10 text-center">
          <p className="font-display font-semibold mb-1" style={{ color: 'var(--text)' }}>Aucune facture</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {invoices.length === 0 ? 'Émettez une facture depuis le panneau d’un devis accepté.' : 'Aucune facture ne correspond à ce filtre.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const late = isOverdue(inv, now)
            const status = late ? { label: 'En retard', color: '#D90000' } : STATUS[inv.status]
            return (
              <div key={inv.id} className="card no-lift p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {inv.numero} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· {inv.kind === 'acompte' ? 'Acompte' : 'Solde'} · {inv.client.nom}{inv.client.societe ? ` (${inv.client.societe})` : ''}</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                      Devis <Link href={`/admin/quotes?q=${encodeURIComponent(inv.quoteNumero)}`} className="underline">{inv.quoteNumero}</Link>
                      {' · '}émise le {formatDate(inv.issuedAt)}
                      {' · '}{inv.kind === 'acompte' ? 'payable dès réception' : `échéance ${formatDate(inv.dueAt)}`}
                      {inv.payment ? ` · payée le ${formatDate(inv.payment.paidAt)} (${inv.payment.method}) — reçu ${inv.payment.receiptNumero}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{fmt(inv.netToPay)}</p>
                    <p className="text-xs font-semibold" style={{ color: status.color }}>{status.label}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button className="btn-secondary btn-xs" disabled={busy === `facture-${inv.id}`} onClick={() => download(inv, 'facture')}>Facture (PDF)</button>
                  {inv.status === 'paid' && (
                    <button className="btn-secondary btn-xs" disabled={busy === `recu-${inv.id}`} onClick={() => download(inv, 'recu')}>Reçu (PDF)</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
