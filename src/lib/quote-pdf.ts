// Server-side PDF generation for devis / contrat / avenant / procès-verbal —
// email attachments and the "Télécharger le PDF" button. Draws from the same
// buildDevisBlocks / buildContractBlocks / buildAvenantBlocks /
// buildAcceptanceBlocks content as the on-screen QuoteView, so the PDF can
// never drift from what the client sees when they open the document.
import QRCode from 'qrcode'
import type { Quote } from '@/actions/quotes'
import type { PersonalInfo } from '@/types'
import { identityLines, resolveTerms, vatLabel, type QuoteTerms } from '@/lib/business'
import {
  buildDevisBlocks, buildContractBlocks, buildAvenantBlocks, buildAcceptanceBlocks, briefEntries, computeQuoteDates,
  devisAcceptanceLabel, documentKind, documentTitle, fmt, formatLongDate, parseLocation, docLang,
  type DocBlock, type DocLang,
} from '@/lib/quote-document'
import { roleFor, vatExemptionFor } from '@/lib/doc-common'
import { docLabels } from '@/lib/doc-labels'
import {
  createPdfKit, fetchImageBytes, safeText, BORDER, INK, MARGIN, MUTED, PAGE_WIDTH, SUBTLE, WHITE, CONTENT_WIDTH,
  type PdfKit,
} from '@/lib/pdf-kit'
import { rgb, type PDFImage } from 'pdf-lib'

interface GenerateOptions {
  quote: Quote
  personal: PersonalInfo
  variant: 'devis' | 'contrat' | 'pv'
  siteUrl: string
  watermark?: string
}

const GREEN = rgb(0.04, 0.48, 0.18)

// Provider block shared by every document: name, legal identity, address,
// contact — only the identity fields actually filled in are printed.
export function drawProviderBlock(kit: PdfKit, t: QuoteTerms, label = '1. PRESTATAIRE', lang: DocLang = 'fr') {
  kit.drawLabel(label)
  kit.drawParagraph(t.provider.name, { size: 9.5, font: kit.fonts.bold, color: INK })
  kit.drawParagraph(roleFor(t.provider.role, lang) || docLabels(lang).defaultRole)
  const identity = identityLines(t)
  if (identity.length) kit.drawParagraph(identity.join('  ·  '))
  const { ville, pays } = parseLocation(t.provider.location)
  kit.drawParagraph(t.address || `${ville}, ${pays}`)
  kit.drawParagraph(t.provider.email)
  if (t.provider.whatsapp) kit.drawParagraph(t.provider.whatsapp)
  kit.state.y -= 6
}

export function drawClientBlock(
  kit: PdfKit,
  quote: Pick<Quote, 'clientNom' | 'clientSociete' | 'clientAdresse' | 'clientEmail' | 'clientTelephone'>,
  label = '2. CLIENT',
) {
  kit.drawLabel(label)
  kit.drawParagraph(quote.clientNom, { size: 9.5, font: kit.fonts.bold, color: INK })
  if (quote.clientSociete) kit.drawParagraph(quote.clientSociete)
  if (quote.clientAdresse) kit.drawParagraph(quote.clientAdresse)
  if (quote.clientEmail) kit.drawParagraph(quote.clientEmail)
  if (quote.clientTelephone) kit.drawParagraph(quote.clientTelephone)
  kit.state.y -= 6
}

interface SignatureBoxOptions {
  lang: DocLang
  title: string
  status: string
  statusColor: ReturnType<typeof rgb>
  signerName: string
  signerEmail: string
  signedAt: string
  documentRef: string
  hash: string
  clientImg: PDFImage | null
  providerImg: PDFImage | null
}

function drawSignatureBox(kit: PdfKit, o: SignatureBoxOptions) {
  const { state, fonts } = kit
  const L = docLabels(o.lang).signature
  kit.drawLabel(o.title)
  const boxHeight = 156
  kit.ensureSpace(boxHeight)
  const boxTop = state.y
  state.page.drawRectangle({ x: MARGIN, y: boxTop - boxHeight, width: CONTENT_WIDTH, height: boxHeight, borderColor: BORDER, borderWidth: 1, color: WHITE })

  let iy = boxTop - 16
  const statusW = fonts.bold.widthOfTextAtSize(safeText(o.status), 8) + 16
  state.page.drawRectangle({ x: MARGIN + 12, y: iy - 12, width: statusW, height: 16, color: o.statusColor })
  state.page.drawText(safeText(o.status), { x: MARGIN + 20, y: iy - 8, size: 8, font: fonts.bold, color: WHITE })

  iy -= 28
  state.page.drawText(safeText(`${L.by} : ${o.signerName}`), { x: MARGIN + 12, y: iy, size: 9, font: fonts.regular, color: INK })
  state.page.drawText(safeText(`${L.email} : ${o.signerEmail}`), { x: MARGIN + 300, y: iy, size: 9, font: fonts.regular, color: INK })

  iy -= 16
  const signedAtStr = new Date(o.signedAt).toLocaleString(o.lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' })
  state.page.drawText(safeText(`${L.when} : ${signedAtStr}`), { x: MARGIN + 12, y: iy, size: 9, font: fonts.regular, color: INK })
  state.page.drawText(safeText(`${L.doc} : ${o.documentRef}`), { x: MARGIN + 300, y: iy, size: 9, font: fonts.regular, color: INK })

  iy -= 16
  state.page.drawText(safeText(`${L.hash} : ${o.hash.slice(0, 32)}...`), { x: MARGIN + 12, y: iy, size: 7, font: fonts.regular, color: SUBTLE })

  // Signature images sit in their own row, well below the metadata above —
  // fixed offsets from boxTop rather than from boxHeight, so this can
  // never silently overlap the text rows if boxHeight is ever tuned.
  const sigLabelY = boxTop - 108
  const sigImageY = sigLabelY - 44
  state.page.drawText(safeText(L.client), { x: MARGIN + 12, y: sigLabelY, size: 7.5, font: fonts.regular, color: SUBTLE })
  if (o.clientImg) {
    const dims = o.clientImg.scale(1)
    const h = 36
    state.page.drawImage(o.clientImg, { x: MARGIN + 12, y: sigImageY, width: Math.min(160, (dims.width / dims.height) * h), height: h })
  }
  state.page.drawText(safeText(L.provider), { x: PAGE_WIDTH - MARGIN - 172, y: sigLabelY, size: 7.5, font: fonts.regular, color: SUBTLE })
  if (o.providerImg) {
    const dims = o.providerImg.scale(1)
    const h = 36
    const w = Math.min(160, (dims.width / dims.height) * h)
    state.page.drawImage(o.providerImg, { x: PAGE_WIDTH - MARGIN - w - 12, y: sigImageY, width: w, height: h })
  } else {
    state.page.drawText(safeText(L.providerMissing), { x: PAGE_WIDTH - MARGIN - 172, y: sigImageY + 18, size: 7.5, font: fonts.italic, color: SUBTLE })
  }
  state.y = boxTop - boxHeight - 16
}

export async function generateQuotePdf({ quote, personal, variant, siteUrl, watermark }: GenerateOptions): Promise<Buffer> {
  const isPv = variant === 'pv'
  const lang = docLang(quote)
  const L = docLabels(lang)
  const t = resolveTerms(quote, personal)
  const { dateEmission } = computeQuoteDates(quote)
  const kind = documentKind(quote, variant === 'contrat' ? 'contrat' : 'devis')
  const isContract = kind === 'contrat' || kind === 'avenant'
  const docTitle = isPv ? L.titles.pv : documentTitle(kind, lang)
  const fileTitle = isPv ? `${L.files.pv} ${quote.numero}` : `${kind.startsWith('avenant') ? L.files.avenant : isContract ? L.files.contrat : L.files.devis} ${quote.numero}`

  const kit = await createPdfKit({
    title: fileTitle,
    producer: `Portfolio ${t.provider.name}`,
    runningName: t.provider.name,
    runningTitle: fileTitle,
    watermark,
    lang,
  })
  const { state, fonts } = kit

  // The current signature wins over the one frozen with the quote: the file
  // behind an old URL may have been replaced or deleted since.
  const providerSigUrl = personal.signatureUrl || t.provider.signatureUrl
  const [logoBytes, clientSigBytes, providerSigBytes, qrBytes] = await Promise.all([
    fetchImageBytes(`${siteUrl}/logo-black.png`),
    (isPv ? quote.acceptance?.imageUrl : quote.signature?.imageUrl) ? fetchImageBytes((isPv ? quote.acceptance?.imageUrl : quote.signature?.imageUrl)!) : Promise.resolve(null),
    providerSigUrl ? fetchImageBytes(providerSigUrl) : Promise.resolve(null),
    QRCode.toBuffer(siteUrl, { margin: 1, width: 200, color: { dark: '#111111', light: '#ffffff' } }).then((b) => new Uint8Array(b)).catch(() => null),
  ])
  kit.logo = await kit.embedImage(logoBytes)
  const clientSigImg = await kit.embedImage(clientSigBytes)
  const providerSigImg = await kit.embedImage(providerSigBytes)
  const qrImg = await kit.embedImage(qrBytes)

  kit.drawMasthead({ name: t.provider.name, role: roleFor(t.provider.role, lang), badge: `${L.no} ${quote.numero}`, sub: `${L.trackingCode} : ${quote.accessCode}` })

  // ── Title + dates ──
  if (isPv) {
    kit.drawTitleRow(docTitle, [
      `${L.deliveryDate} : ${quote.delivery ? formatLongDate(quote.delivery.deliveredAt, lang) : '-'}`,
      `${L.reference} : ${quote.kind === 'avenant' ? L.refAvenant(quote.numero) : L.refDevis(quote.numero)}`,
    ], 18)
  } else {
    kit.drawTitleRow(docTitle, [`${L.issueDate} : ${dateEmission}`, `${L.offerValidity} : ${L.days(quote.validiteJours)}`])
  }

  // The PV's own sections are numbered from 1, so its parties are unnumbered.
  drawProviderBlock(kit, t, isPv ? L.provider : `1. ${L.provider}`, lang)
  drawClientBlock(kit, quote, isPv ? L.client : `2. ${L.client}`)

  let blocks: DocBlock[]
  if (isPv) {
    blocks = buildAcceptanceBlocks(quote, personal)
  } else {
    // ── Project (+ brief) ──
    kit.drawLabel(`3. ${L.project}`)
    if (quote.kind === 'avenant' && quote.parentNumero) {
      kit.drawParagraph(L.avenantOf(quote.parentNumero), { font: fonts.bold, color: INK })
    }
    kit.drawParagraph(quote.descriptionProjet)
    for (const { label, value } of briefEntries(quote)) {
      kit.state.y -= 3
      kit.drawParagraph(label, { size: 8.5, font: fonts.bold, color: INK })
      kit.drawParagraph(value, { size: 9 })
    }
    kit.state.y -= 4

    // ── Items table + totals ──
    kit.drawLabel(`4. ${L.items}`)
    kit.drawTable(
      quote.items.map((it) => ({
        designation: it.designation,
        quantite: it.quantite,
        unit: fmt(it.prixUnitaireHT, lang),
        total: fmt(it.quantite * it.prixUnitaireHT, lang),
      })),
      { priceLabel: t.vatEnabled ? L.table.priceHT : L.table.price, totalLabel: t.vatEnabled ? L.table.totalHT : L.table.total },
    )
    kit.drawTotals(
      t.vatEnabled
        ? [[L.totals.ht, fmt(quote.totalHT, lang), false], [vatLabel(t, lang), fmt(quote.tva, lang), false], [L.totals.ttc, fmt(quote.totalTTC, lang), true]]
        : [[L.totals.total, fmt(quote.totalTTC, lang), true]],
    )
    if (!t.vatEnabled) kit.drawParagraph(vatExemptionFor(t.vatExemptionMention, lang), { size: 8.5 })

    kit.drawLine()
    blocks = kind === 'avenant' || kind === 'avenant-proposition'
      ? buildAvenantBlocks(quote, personal)
      : isContract
        ? buildContractBlocks(quote, personal, siteUrl)
        : buildDevisBlocks(quote, personal, siteUrl)
  }

  for (const block of blocks) kit.drawBlock(block)

  // ── Acceptance / signature ──
  if (isPv) {
    if (quote.acceptance) {
      drawSignatureBox(kit, {
        lang,
        title: L.signature.title,
        status: quote.acceptance.reserves ? L.pv.withReserves : L.pv.withoutReserves,
        statusColor: quote.acceptance.reserves ? rgb(0.7, 0.4, 0) : GREEN,
        signerName: quote.acceptance.name,
        signerEmail: quote.acceptance.email,
        signedAt: quote.acceptance.signedAt,
        documentRef: L.signature.pvDoc(quote.numero),
        hash: quote.acceptance.documentHash,
        clientImg: clientSigImg,
        providerImg: providerSigImg,
      })
    } else {
      kit.drawLabel(L.signature.pvHeading)
      kit.drawParagraph(L.signature.pvLine, { font: fonts.bold, color: INK })
      kit.state.y -= 24
      kit.drawSignature(providerSigImg, L.signature.provider)
    }
  } else if (quote.signature) {
    drawSignatureBox(kit, {
      lang,
      title: L.signature.title,
      status: L.signature.signed,
      statusColor: GREEN,
      signerName: quote.signature.name,
      signerEmail: quote.signature.email,
      signedAt: quote.signature.signedAt,
      documentRef: quote.numero,
      hash: quote.signature.documentHash,
      clientImg: clientSigImg,
      providerImg: providerSigImg,
    })
  } else {
    kit.drawLabel(isContract ? L.signature.contractParties : devisAcceptanceLabel(blocks.length, lang))
    kit.drawParagraph(
      isContract ? L.signature.contractLine : L.signature.devisLine,
      { font: fonts.bold, color: INK },
    )
    kit.state.y -= 24
    // The offer itself is signed by the provider when it is issued (see the
    // "Signature électronique et preuve" clause) — show that signature.
    kit.drawSignature(providerSigImg, L.signature.providerOffer)
  }

  const signedByBoth = isPv ? !!quote.acceptance : !!quote.signature
  const footerNote = signedByBoth
    ? L.footer.signedBoth
    : isPv
      ? L.footer.pending
      : L.footer.offer

  // The PV is a short single-purpose page whose header already carries the
  // provider's identity: its only footer is the one-line note in the bottom
  // margin, so it can never push the document onto a second page by itself.
  if (isPv) {
    state.page.drawText(safeText(footerNote), { x: MARGIN, y: MARGIN - 4, size: 7.5, font: fonts.regular, color: SUBTLE })
    return kit.finish()
  }

  kit.drawLine()

  // ── Footer: QR + provider name ──
  kit.ensureSpace(60)
  if (qrImg) state.page.drawImage(qrImg, { x: MARGIN, y: state.y - 50, width: 50, height: 50 })
  state.page.drawText(safeText(t.provider.name), { x: PAGE_WIDTH - MARGIN - 250, y: state.y - 14, size: 9.5, font: fonts.bold, color: INK })
  state.page.drawText(safeText(footerNote), { x: PAGE_WIDTH - MARGIN - 250, y: state.y - 26, size: 7.5, font: fonts.regular, color: SUBTLE })
  const identity = identityLines(t)
  if (identity.length) {
    state.page.drawText(safeText(identity.join('  ·  ')), { x: PAGE_WIDTH - MARGIN - 250, y: state.y - 38, size: 7, font: fonts.regular, color: MUTED })
  }

  return kit.finish()
}
