// Server-side PDF for factures (acompte / solde) and reçus de paiement — same
// pdf-lib toolkit and look as the devis/contrat, generated from the invoice's
// own frozen snapshot (client, amounts, terms), never from the live quote, so
// a re-download years later prints exactly what was issued.
import type { Invoice } from '@/actions/billing'
import { frNumber, identityLines, vatLabel } from '@/lib/business'
import { fmt, formatLongDate } from '@/lib/quote-document'
import { createPdfKit, fetchImageBytes, safeText, BORDER, INK, MARGIN, MUTED, SUBTLE, WHITE, CONTENT_WIDTH, PAGE_WIDTH } from '@/lib/pdf-kit'
import { drawClientBlock, drawProviderBlock } from '@/lib/quote-pdf'
import { rgb } from 'pdf-lib'

interface GenerateOptions {
  invoice: Invoice
  document: 'facture' | 'recu'
  siteUrl: string
  // The provider's current signature image, stamped on every invoice and receipt.
  signatureUrl?: string
  watermark?: string
}

const GREEN = rgb(0.04, 0.48, 0.18)
const RED = rgb(0.75, 0.1, 0.1)

const TITLE = { acompte: "FACTURE D'ACOMPTE", solde: 'FACTURE DE SOLDE' } as const

export async function generateInvoicePdf({ invoice, document, siteUrl, signatureUrl, watermark }: GenerateOptions): Promise<Buffer> {
  const t = invoice.terms
  const isReceipt = document === 'recu'
  const number = isReceipt ? invoice.payment?.receiptNumero ?? invoice.numero : invoice.numero
  const title = isReceipt ? 'REÇU DE PAIEMENT' : TITLE[invoice.kind]
  const fileTitle = `${isReceipt ? 'Reçu' : 'Facture'} ${number}`
  const docWord = invoice.quoteKind === 'avenant' ? 'avenant' : 'devis'

  const kit = await createPdfKit({ title: fileTitle, producer: `Portfolio ${t.provider.name}`, runningName: t.provider.name, runningTitle: fileTitle, watermark })
  const { state, fonts } = kit
  kit.logo = await kit.embedImage(await fetchImageBytes(`${siteUrl}/logo-black.png`))
  const signatureImg = await kit.embedImage(signatureUrl ? await fetchImageBytes(signatureUrl) : null)

  kit.drawMasthead({ name: t.provider.name, role: t.provider.role, badge: `N° ${number}`, sub: `Réf. ${docWord} ${invoice.quoteNumero}` })
  kit.drawTitleRow(
    title,
    isReceipt
      ? [`Date du paiement : ${invoice.payment ? formatLongDate(invoice.payment.paidAt) : '-'}`, `Facture n° ${invoice.numero}`]
      : [`Date d'émission : ${formatLongDate(invoice.issuedAt)}`, `Échéance : ${invoice.kind === 'acompte' ? 'à réception' : formatLongDate(invoice.dueAt)}`],
    20,
  )

  drawProviderBlock(kit, t, isReceipt ? '1. REÇU PAR' : '1. ÉMETTEUR')
  drawClientBlock(kit, {
    clientNom: invoice.client.nom, clientSociete: invoice.client.societe, clientAdresse: invoice.client.adresse,
    clientEmail: invoice.client.email, clientTelephone: invoice.client.telephone,
  }, isReceipt ? '2. REÇU DE' : '2. CLIENT')

  if (isReceipt && invoice.payment) {
    const p = invoice.payment
    kit.drawLabel('3. PAIEMENT')
    const boxH = 84
    kit.ensureSpace(boxH + 10)
    const top = state.y
    state.page.drawRectangle({ x: MARGIN, y: top - boxH, width: CONTENT_WIDTH, height: boxH, borderColor: BORDER, borderWidth: 1, color: WHITE })
    state.page.drawRectangle({ x: MARGIN + 12, y: top - 26, width: 74, height: 16, color: GREEN })
    state.page.drawText('PAYE', { x: MARGIN + 20, y: top - 22, size: 8, font: fonts.bold, color: WHITE })
    state.page.drawText(safeText(`Montant reçu : ${fmt(invoice.netToPay)}`), { x: MARGIN + 12, y: top - 44, size: 11, font: fonts.bold, color: INK })
    state.page.drawText(safeText(`Mode de règlement : ${p.method}`), { x: MARGIN + 12, y: top - 60, size: 9, font: fonts.regular, color: INK })
    state.page.drawText(safeText(p.reference ? `Référence : ${p.reference}` : 'Référence : -'), { x: MARGIN + 300, y: top - 60, size: 9, font: fonts.regular, color: INK })
    state.page.drawText(safeText(`Pour l'acquit de la facture n° ${invoice.numero} (${docWord} n° ${invoice.quoteNumero}).`), { x: MARGIN + 12, y: top - 75, size: 8, font: fonts.regular, color: SUBTLE })
    state.y = top - boxH - 16
  } else {
    kit.drawLabel('3. DÉTAIL')
    kit.drawTable(
      invoice.lines.map((l) => ({
        designation: l.designation,
        quantite: l.quantite,
        unit: fmt(l.prixUnitaireHT),
        total: fmt(l.quantite * l.prixUnitaireHT),
      })),
      { priceLabel: t.vatEnabled ? 'PRIX HT' : 'PRIX', totalLabel: t.vatEnabled ? 'TOTAL HT' : 'TOTAL' },
    )
    const rows: [string, string, boolean][] = t.vatEnabled
      ? [['Total HT', fmt(invoice.totalHT), false], [vatLabel(t), fmt(invoice.tva), false], ['Total TTC', fmt(invoice.totalTTC), false]]
      : [['Total', fmt(invoice.totalTTC), false]]
    for (const d of invoice.deductions) rows.push(['Acompte déjà réglé', `- ${fmt(d.amountTTC)}`, false])
    rows.push(['Net à payer', fmt(invoice.netToPay), true])
    kit.drawTotals(rows)
    if (invoice.deductions.length) kit.drawParagraph(invoice.deductions.map((d) => d.label).join(' ; '), { size: 8 })

    kit.drawLine()
    kit.drawBlock({
      title: 'MODALITÉS DE RÈGLEMENT',
      paragraphs: [
        invoice.kind === 'acompte'
          ? "Cette facture d'acompte est payable dès réception : le développement débute après son paiement."
          : `Cette facture est payable au plus tard le ${formatLongDate(invoice.dueAt)}.`,
        `Moyens de paiement acceptés : ${t.paymentMethods}.`,
        ...(t.paymentDetails ? [`Coordonnées de paiement : ${t.paymentDetails}`] : []),
        `En cas de retard de paiement, des pénalités de ${frNumber(t.latePenaltyRate)} % par mois de retard (tout mois commencé étant dû) sont applicables de plein droit, sans mise en demeure préalable.`,
        ...(!t.vatEnabled ? [t.vatExemptionMention] : []),
      ],
    })

    if (invoice.status === 'paid' && invoice.payment) {
      kit.ensureSpace(24)
      state.page.drawText(safeText(`ACQUITTÉE le ${formatLongDate(invoice.payment.paidAt)} - reçu n° ${invoice.payment.receiptNumero}`), { x: MARGIN, y: state.y - 10, size: 9, font: fonts.bold, color: GREEN })
      state.y -= 24
    } else if (invoice.status === 'cancelled') {
      kit.ensureSpace(24)
      state.page.drawText(safeText('FACTURE ANNULÉE - ne pas régler'), { x: MARGIN, y: state.y - 10, size: 9, font: fonts.bold, color: RED })
      state.y -= 24
    }
  }

  kit.drawSignature(signatureImg, 'Signature du prestataire')
  kit.drawLine()
  kit.ensureSpace(40)
  state.page.drawText(safeText(t.provider.name), { x: MARGIN, y: state.y - 12, size: 9.5, font: fonts.bold, color: INK })
  const identity = [...identityLines(t), ...(t.address ? [t.address] : [])].join('  ·  ')
  if (identity) state.page.drawText(safeText(identity), { x: MARGIN, y: state.y - 24, size: 7.5, font: fonts.regular, color: MUTED })
  const note = 'Document généré électroniquement'
  state.page.drawText(safeText(note), { x: PAGE_WIDTH - MARGIN - fonts.regular.widthOfTextAtSize(note, 7.5), y: state.y - 12, size: 7.5, font: fonts.regular, color: SUBTLE })

  return kit.finish()
}
