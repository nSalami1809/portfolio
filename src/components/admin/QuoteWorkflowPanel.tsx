'use client'

import { useState } from 'react'
import { downloadQuotePdf, type AdminQuote, type QuoteItem } from '@/actions/quotes'
import { issueInvoice, markInvoicePaid, cancelInvoice, resendInvoiceEmail, downloadInvoicePdf, type Invoice } from '@/actions/billing'
import { markDelivered, createAvenant } from '@/actions/lifecycle'
import { saveBase64Pdf } from '@/lib/browser-download'
import { formatLongDate, RECETTE_DAYS, addBusinessDays } from '@/lib/quote-document'

interface Props {
  quote: AdminQuote
  invoices: Invoice[]
  onChanged: () => void | Promise<void>
  notify: (message: string, type?: 'error') => void
}

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
const PAYMENT_METHODS = ['Virement bancaire', 'Airtel Money', 'Moov Money', 'Espèces', 'Chèque', 'Autre']
const INVOICE_STATUS: Record<Invoice['status'], { label: string; color: string }> = {
  issued: { label: 'À payer', color: '#E45742' },
  paid: { label: 'Payée', color: '#008000' },
  cancelled: { label: 'Annulée', color: 'var(--text-subtle)' },
}

const sectionTitle = 'text-xs font-semibold mb-2.5'
const sectionTitleStyle = { color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' } as const
const EMPTY_ITEM: QuoteItem = { designation: '', quantite: 1, prixUnitaireHT: 0 }

// Everything that happens to a quote after the client signs: delivery + PV,
// the two invoices (deposit / balance) with their receipts, and avenants.
export default function QuoteWorkflowPanel({ quote, invoices, onChanged, notify }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [deliveryNote, setDeliveryNote] = useState('')
  const [liveUrl, setLiveUrl] = useState('')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0])
  const [payRef, setPayRef] = useState('')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showAvenant, setShowAvenant] = useState(false)
  const [avDescription, setAvDescription] = useState('')
  const [avDelay, setAvDelay] = useState('')
  const [avItems, setAvItems] = useState<QuoteItem[]>([{ ...EMPTY_ITEM }])

  const accepted = quote.status === 'accepted'
  const mine = invoices.filter((i) => i.quoteNumero === quote.numero)
  const active = mine.filter((i) => i.status !== 'cancelled')
  const hasDeposit = quote.terms ? quote.terms.depositPercent > 0 && quote.terms.depositPercent < 100 : true
  const depositInvoice = active.find((i) => i.kind === 'acompte')
  const balanceInvoice = active.find((i) => i.kind === 'solde')

  const run = async (key: string, action: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    setBusy(key)
    try {
      const result = await action()
      const message = result.message ?? result.error ?? ''
      if (message) notify(message, result.ok ? undefined : 'error')
      if (result.ok) await onChanged()
      return result.ok
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Une erreur est survenue.', 'error')
      return false
    } finally {
      setBusy(null)
    }
  }

  const download = (key: string, action: () => ReturnType<typeof downloadQuotePdf>) =>
    run(key, async () => {
      const result = await action()
      if (result.ok) { saveBase64Pdf(result.base64, result.filename); return { ok: true } }
      return { ok: false, error: result.error }
    })

  const submitAvenant = async () => {
    const ok = await run('avenant', () => createAvenant(quote.id, {
      description: avDescription,
      items: avItems,
      extraDelayDays: avDelay ? Number(avDelay) : 0,
    }))
    if (ok) {
      setShowAvenant(false)
      setAvDescription('')
      setAvDelay('')
      setAvItems([{ ...EMPTY_ITEM }])
    }
  }

  const setItem = (index: number, patch: Partial<QuoteItem>) =>
    setAvItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))

  const btn = 'btn-secondary btn-xs'

  return (
    <div className="mt-4 pt-4 space-y-5" style={{ borderTop: '1px solid var(--border)' }}>
      {/* Documents */}
      <div>
        <p className={sectionTitle} style={sectionTitleStyle}>Documents</p>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={busy === 'doc'} onClick={() => download('doc', () => downloadQuotePdf(quote.accessCode))}>
            {accepted ? (quote.kind === 'avenant' ? 'Avenant (PDF)' : 'Contrat (PDF)') : (quote.kind === 'avenant' ? 'Avenant proposé (PDF)' : 'Devis (PDF)')}
          </button>
          {quote.delivery && (
            <button className={btn} disabled={busy === 'pv'} onClick={() => download('pv', () => downloadQuotePdf(quote.accessCode, 'pv'))}>
              Procès-verbal de recette (PDF)
            </button>
          )}
        </div>
      </div>

      {!accepted ? (
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          La livraison, la facturation et les avenants sont disponibles une fois le devis accepté (signé par le client).
        </p>
      ) : (
        <>
          {/* Livraison & recette */}
          <div>
            <p className={sectionTitle} style={sectionTitleStyle}>Livraison &amp; procès-verbal de recette</p>
            {!quote.delivery ? (
              <div className="space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <input className="input" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="Adresse du site livré (https://…) — facultatif" maxLength={300} />
                  <input className="input" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="Remarques pour le client — facultatif" maxLength={1000} />
                </div>
                <button
                  className="btn-primary btn-xs"
                  disabled={busy === 'deliver'}
                  onClick={() => confirm('Marquer ce projet comme livré ? Le client recevra le procès-verbal de recette à signer.') && run('deliver', () => markDelivered(quote.id, { note: deliveryNote, liveUrl }))}
                >
                  {busy === 'deliver' ? 'Envoi…' : 'Marquer comme livré et envoyer le PV'}
                </button>
              </div>
            ) : (
              <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                <p>Livré le <strong style={{ color: 'var(--text)' }}>{formatLongDate(quote.delivery.deliveredAt)}</strong>.</p>
                {quote.acceptance ? (
                  <p style={{ color: quote.acceptance.reserves ? '#E45742' : '#008000' }}>
                    Recette signée par {quote.acceptance.name} le {formatLongDate(quote.acceptance.signedAt)}
                    {quote.acceptance.reserves ? ` — AVEC RÉSERVES : « ${quote.acceptance.reserves} »` : ' — sans réserve.'}
                  </p>
                ) : (
                  <p>En attente de signature du PV — recette réputée acceptée le {formatLongDate(addBusinessDays(quote.delivery.deliveredAt, RECETTE_DAYS))} à défaut de retour.</p>
                )}
              </div>
            )}
          </div>

          {/* Facturation */}
          <div>
            <p className={sectionTitle} style={sectionTitleStyle}>Facturation</p>
            {mine.length > 0 && (
              <ul className="space-y-2 mb-3">
                {mine.map((inv) => (
                  <li key={inv.id} className="p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs" style={{ color: 'var(--text)' }}>
                        <strong>{inv.numero}</strong> · {inv.kind === 'acompte' ? 'Acompte' : 'Solde'} · {fmt(inv.netToPay)} · échéance {formatLongDate(inv.dueAt)}
                      </p>
                      <span className="text-xs font-semibold" style={{ color: INVOICE_STATUS[inv.status].color }}>{INVOICE_STATUS[inv.status].label}</span>
                    </div>
                    {inv.payment && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                        Reçu {inv.payment.receiptNumero} — payée le {formatLongDate(inv.payment.paidAt)} ({inv.payment.method}{inv.payment.reference ? `, réf. ${inv.payment.reference}` : ''})
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button className={btn} disabled={busy === `f-${inv.id}`} onClick={() => download(`f-${inv.id}`, () => downloadInvoicePdf(inv.id, 'facture'))}>Facture (PDF)</button>
                      {inv.status === 'paid' && (
                        <button className={btn} disabled={busy === `r-${inv.id}`} onClick={() => download(`r-${inv.id}`, () => downloadInvoicePdf(inv.id, 'recu'))}>Reçu (PDF)</button>
                      )}
                      {inv.client.email && inv.status !== 'cancelled' && (
                        <button className={btn} disabled={busy === `m-${inv.id}`} onClick={() => run(`m-${inv.id}`, () => resendInvoiceEmail(inv.id, inv.status === 'paid' ? 'recu' : 'facture'))}>Renvoyer par email</button>
                      )}
                      {inv.status === 'issued' && (
                        <>
                          <button className="btn-primary btn-xs" onClick={() => setPayingId(payingId === inv.id ? null : inv.id)}>Marquer comme payée</button>
                          <button
                            className={btn}
                            disabled={busy === `c-${inv.id}`}
                            onClick={() => confirm(`Annuler la facture ${inv.numero} ? Son numéro ne sera pas réutilisé.`) && run(`c-${inv.id}`, () => cancelInvoice(inv.id))}
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                    {payingId === inv.id && (
                      <div className="grid sm:grid-cols-4 gap-2 mt-3">
                        <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} aria-label="Moyen de paiement">
                          {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                        </select>
                        <input className="input" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Référence (facultatif)" maxLength={100} />
                        <input className="input" type="date" value={payDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPayDate(e.target.value)} aria-label="Date du paiement" />
                        <button
                          className="btn-primary btn-xs justify-center"
                          disabled={busy === `p-${inv.id}`}
                          onClick={async () => {
                            const ok = await run(`p-${inv.id}`, () => markInvoicePaid(inv.id, { method: payMethod, reference: payRef, paidAt: payDate }))
                            if (ok) { setPayingId(null); setPayRef('') }
                          }}
                        >
                          Enregistrer + envoyer le reçu
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              {hasDeposit && !depositInvoice && (
                <button className="btn-primary btn-xs" disabled={busy === 'issue-acompte'} onClick={() => run('issue-acompte', () => issueInvoice(quote.id, 'acompte'))}>
                  Émettre la facture d&apos;acompte
                </button>
              )}
              {!balanceInvoice && (
                <button
                  className="btn-primary btn-xs"
                  disabled={busy === 'issue-solde' || !quote.delivery || (hasDeposit && depositInvoice?.status !== 'paid')}
                  title={!quote.delivery ? "Marquez d'abord le projet comme livré" : hasDeposit && depositInvoice?.status !== 'paid' ? "L'acompte doit être payé" : undefined}
                  onClick={() => run('issue-solde', () => issueInvoice(quote.id, 'solde'))}
                >
                  Émettre la facture de {hasDeposit ? 'solde' : 'paiement'}
                </button>
              )}
              {!quote.delivery && !balanceInvoice && (
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>La facture de solde se débloque une fois le projet livré{hasDeposit ? ' et l’acompte payé' : ''}.</span>
              )}
            </div>
          </div>

          {/* Avenant */}
          {quote.kind !== 'avenant' && (
            <div>
              <p className={sectionTitle} style={sectionTitleStyle}>Avenant (prestations complémentaires)</p>
              {!showAvenant ? (
                <button className={btn} onClick={() => setShowAvenant(true)}>Créer un avenant</button>
              ) : (
                <div className="space-y-3 p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <textarea className="input" rows={3} value={avDescription} onChange={(e) => setAvDescription(e.target.value)} placeholder="Objet de l'avenant : ce qui est ajouté ou modifié" maxLength={2000} style={{ resize: 'vertical' }} />
                  {avItems.map((it, i) => (
                    <div key={i} className="grid grid-cols-[1fr_4.5rem_8rem_auto] gap-2 items-center">
                      <input className="input" value={it.designation} onChange={(e) => setItem(i, { designation: e.target.value })} placeholder="Prestation" maxLength={200} aria-label="Désignation" />
                      <input className="input" type="number" min={1} max={99} value={it.quantite} onChange={(e) => setItem(i, { quantite: Number(e.target.value) })} aria-label="Quantité" />
                      <input className="input" type="number" min={0} value={it.prixUnitaireHT || ''} onChange={(e) => setItem(i, { prixUnitaireHT: Number(e.target.value) })} placeholder="Prix HT" aria-label="Prix unitaire HT" />
                      <button className={btn} onClick={() => setAvItems((prev) => prev.filter((_, j) => j !== i))} disabled={avItems.length === 1} aria-label="Retirer la ligne">×</button>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2">
                    <button className={btn} onClick={() => setAvItems((prev) => [...prev, { ...EMPTY_ITEM }])} disabled={avItems.length >= 30}>+ Ligne</button>
                    <input className="input" style={{ width: '11rem' }} type="number" min={0} max={365} value={avDelay} onChange={(e) => setAvDelay(e.target.value)} placeholder="Jours ouvrés ajoutés" aria-label="Délai supplémentaire (jours ouvrés)" />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary btn-xs" disabled={busy === 'avenant'} onClick={submitAvenant}>
                      {busy === 'avenant' ? 'Création…' : "Créer et envoyer l'avenant"}
                    </button>
                    <button className={btn} onClick={() => setShowAvenant(false)}>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
