// Server-side PDF for factures (acompte / solde) and reçus de paiement — same
// pdf-lib toolkit and look as the devis/contrat, generated from the invoice's
// own frozen snapshot (client, amounts, terms), never from the live quote, so
// a re-download years later prints exactly what was issued.
import type { Invoice } from '@/lib/invoicing'
import { identityLines, vatLabel } from '@/lib/business'
import { fmt, formatLongDate, paymentMethodsFor, roleFor, vatExemptionFor, type DocLang } from '@/lib/doc-common'
import { docLabels } from '@/lib/doc-labels'
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

export async function generateInvoicePdf({ invoice, document, siteUrl, signatureUrl, watermark }: GenerateOptions): Promise<Buffer> {
  const t = invoice.terms
  const isReceipt = document === 'recu'
  const number = isReceipt ? invoice.payment?.receiptNumero ?? invoice.numero : invoice.numero
  const lang: DocLang = invoice.locale === 'en' ? 'en' : 'fr'
  const L = docLabels(lang)
  const I = L.invoice
  const money = (n: number) => fmt(n, lang)
  const when = (d: string) => formatLongDate(d, lang)
  const title = isReceipt ? L.titles.recu : invoice.kind === 'acompte' ? L.titles.factureAcompte : L.titles.factureSolde
  const fileTitle = `${isReceipt ? L.files.recu : L.files.facture} ${number}`
  const docWord = invoice.quoteKind === 'avenant' ? L.docWord.avenant : L.docWord.devis

  const kit = await createPdfKit({ title: fileTitle, producer: `Portfolio ${t.provider.name}`, runningName: t.provider.name, runningTitle: fileTitle, watermark, lang })
  const { state, fonts } = kit
  kit.logo = await kit.embedImage(await fetchImageBytes(`${siteUrl}/logo-black.png`))
  const signatureImg = await kit.embedImage(signatureUrl ? await fetchImageBytes(signatureUrl) : null)

  kit.drawMasthead({ name: t.provider.name, role: roleFor(t.provider.role, lang), badge: `${L.no} ${number}`, sub: I.docRef(docWord, invoice.quoteNumero) })
  kit.drawTitleRow(
    title,
    isReceipt
      ? [`${I.paymentDate} : ${invoice.payment ? when(invoice.payment.paidAt) : '-'}`, `${I.invoiceNo} ${invoice.numero}`]
      : [`${L.issueDate} : ${when(invoice.issuedAt)}`, `${I.due} : ${invoice.kind === 'acompte' ? I.dueOnReceipt : when(invoice.dueAt)}`],
    20,
  )

  drawProviderBlock(kit, t, `1. ${isReceipt ? I.receivedBy : I.issuer}`, lang)
  drawClientBlock(kit, {
    clientNom: invoice.client.nom, clientSociete: invoice.client.societe, clientAdresse: invoice.client.adresse,
    clientEmail: invoice.client.email, clientTelephone: invoice.client.telephone,
  }, `2. ${isReceipt ? I.receivedFrom : L.client}`)

  if (isReceipt && invoice.payment) {
    const p = invoice.payment
    kit.drawLabel(`3. ${I.payment}`)
    const boxH = 84
    kit.ensureSpace(boxH + 10)
    const top = state.y
    state.page.drawRectangle({ x: MARGIN, y: top - boxH, width: CONTENT_WIDTH, height: boxH, borderColor: BORDER, borderWidth: 1, color: WHITE })
    state.page.drawRectangle({ x: MARGIN + 12, y: top - 26, width: 74, height: 16, color: GREEN })
    state.page.drawText(I.paid, { x: MARGIN + 20, y: top - 22, size: 8, font: fonts.bold, color: WHITE })
    state.page.drawText(safeText(`${I.amountReceived} : ${money(invoice.netToPay)}`), { x: MARGIN + 12, y: top - 44, size: 11, font: fonts.bold, color: INK })
    state.page.drawText(safeText(`${I.method} : ${p.method}`), { x: MARGIN + 12, y: top - 60, size: 9, font: fonts.regular, color: INK })
    state.page.drawText(safeText(p.reference ? `${I.ref} : ${p.reference}` : `${I.ref} : -`), { x: MARGIN + 300, y: top - 60, size: 9, font: fonts.regular, color: INK })
    state.page.drawText(safeText(I.forInvoice(invoice.numero, docWord, invoice.quoteNumero)), { x: MARGIN + 12, y: top - 75, size: 8, font: fonts.regular, color: SUBTLE })
    state.y = top - boxH - 16
  } else {
    kit.drawLabel(`3. ${I.detail}`)
    kit.drawTable(
      invoice.lines.map((l) => ({
        designation: l.designation,
        quantite: l.quantite,
        unit: money(l.prixUnitaireHT),
        total: money(l.quantite * l.prixUnitaireHT),
      })),
      { priceLabel: t.vatEnabled ? L.table.priceHT : L.table.price, totalLabel: t.vatEnabled ? L.table.totalHT : L.table.total },
    )
    const rows: [string, string, boolean][] = t.vatEnabled
      ? [[L.totals.ht, money(invoice.totalHT), false], [vatLabel(t, lang), money(invoice.tva), false], [L.totals.ttc, money(invoice.totalTTC), false]]
      : [[L.totals.total, money(invoice.totalTTC), false]]
    for (const d of invoice.deductions) rows.push([I.deduction, `- ${money(d.amountTTC)}`, false])
    rows.push([I.net, money(invoice.netToPay), true])
    kit.drawTotals(rows)
    if (invoice.deductions.length) kit.drawParagraph(invoice.deductions.map((d) => d.label).join(' ; '), { size: 8 })

    kit.drawLine()
    kit.drawBlock({
      title: I.settlementTitle,
      paragraphs: [
        invoice.kind === 'acompte' ? I.depositPayable : I.payableBy(when(invoice.dueAt)),
        I.accepted(paymentMethodsFor(t.paymentMethods, lang)),
        ...(t.paymentDetails ? [I.details(t.paymentDetails)] : []),
        I.late(lang === 'en' ? String(t.latePenaltyRate) : String(t.latePenaltyRate).replace('.', ',')),
        ...(!t.vatEnabled ? [vatExemptionFor(t.vatExemptionMention, lang)] : []),
      ],
    })

    if (invoice.status === 'paid' && invoice.payment) {
      kit.ensureSpace(24)
      state.page.drawText(safeText(I.settled(when(invoice.payment.paidAt), invoice.payment.receiptNumero)), { x: MARGIN, y: state.y - 10, size: 9, font: fonts.bold, color: GREEN })
      state.y -= 24
    } else if (invoice.status === 'cancelled') {
      kit.ensureSpace(24)
      state.page.drawText(safeText(I.cancelled), { x: MARGIN, y: state.y - 10, size: 9, font: fonts.bold, color: RED })
      state.y -= 24
    }
  }

  kit.drawSignature(signatureImg, I.sigProvider)
  kit.drawLine()
  kit.ensureSpace(40)
  state.page.drawText(safeText(t.provider.name), { x: MARGIN, y: state.y - 12, size: 9.5, font: fonts.bold, color: INK })
  const identity = [...identityLines(t), ...(t.address ? [t.address] : [])].join('  ·  ')
  if (identity) state.page.drawText(safeText(identity), { x: MARGIN, y: state.y - 24, size: 7.5, font: fonts.regular, color: MUTED })
  const note = L.footer.generated
  state.page.drawText(safeText(note), { x: PAGE_WIDTH - MARGIN - fonts.regular.widthOfTextAtSize(note, 7.5), y: state.y - 12, size: 7.5, font: fonts.regular, color: SUBTLE })

  return kit.finish()
}
