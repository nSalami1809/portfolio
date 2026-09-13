// Server-side PDF generation for devis/contrat email attachments — pure
// pdf-lib (no headless browser), so it runs reliably in a Vercel serverless
// function. Draws from the same buildDevisBlocks/buildContractBlocks content
// as the on-screen QuoteView, so the emailed PDF can never drift from what
// the client sees when they open the document in the app.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import QRCode from 'qrcode'
import type { Quote } from '@/actions/quotes'
import type { PersonalInfo } from '@/types'
import { buildDevisBlocks, buildContractBlocks, computeQuoteDates, fmt, type DocBlock } from './quote-document'

const PAGE_WIDTH = 595.28 // A4 in points
const PAGE_HEIGHT = 841.89
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const INK = rgb(0.07, 0.07, 0.07)
const MUTED = rgb(0.33, 0.33, 0.33)
const SUBTLE = rgb(0.55, 0.55, 0.55)
const BORDER = rgb(0.85, 0.85, 0.85)
const WHITE = rgb(1, 1, 1)

// pdf-lib's standard fonts only encode WinAnsi (cp1252) — safe for French
// accents and typographic dashes/quotes, but a stray character outside that
// range (an emoji making it into user-entered text, say) would throw at
// draw time. Strip anything WinAnsi can't represent rather than crash a
// background email send over it.
// The exact set of Windows-1252 codepoints outside ASCII/Latin-1 that
// WinAnsiEncoding maps specially (em/en dash, curly quotes, ellipsis, oe
// ligature, etc.) — a naive "codepoint <= 0xFF" check rejects every one of
// these even though pdf-lib can draw them fine, which is what silently
// turned every em dash and curly apostrophe in the legal text into "?".
const WINANSI_EXTRA_CODEPOINTS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])

function isWinAnsiEncodable(codePoint: number): boolean {
  if (codePoint <= 0x7e) return true // ASCII
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true // Latin-1 supplement (accented letters, punctuation)
  return WINANSI_EXTRA_CODEPOINTS.has(codePoint)
}

function safeText(text: string): string {
  return Array.from(text)
    .map((ch) => (isWinAnsiEncodable(ch.codePointAt(0)!) ? ch : '?'))
    .join('')
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safeText(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

interface GenerateOptions {
  quote: Quote
  personal: PersonalInfo
  variant: 'devis' | 'contrat'
  siteUrl: string
}

export async function generateQuotePdf({ quote, personal, variant, siteUrl }: GenerateOptions): Promise<Buffer> {
  const isContract = variant === 'contrat'
  const { dateEmission } = computeQuoteDates(quote)
  const blocks: DocBlock[] = isContract ? buildContractBlocks(quote, personal) : buildDevisBlocks(quote)

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`${isContract ? 'Contrat' : 'Devis'} ${quote.numero}`)
  pdfDoc.setProducer('Portfolio Nawaf Nemrod SALAMI')

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const [logoBytes, clientSigBytes, providerSigBytes, qrBytes] = await Promise.all([
    fetchImageBytes(`${siteUrl}/logo-black.png`),
    quote.signature ? fetchImageBytes(quote.signature.imageUrl) : Promise.resolve(null),
    personal.signatureUrl ? fetchImageBytes(personal.signatureUrl) : Promise.resolve(null),
    QRCode.toBuffer(siteUrl, { margin: 1, width: 200, color: { dark: '#111111', light: '#ffffff' } }).then((b) => new Uint8Array(b)).catch(() => null),
  ])

  const logoImg = logoBytes ? await pdfDoc.embedPng(logoBytes).catch(() => null) : null
  const clientSigImg = clientSigBytes ? await pdfDoc.embedPng(clientSigBytes).catch(() => null) : null
  const providerSigImg = providerSigBytes ? await pdfDoc.embedPng(providerSigBytes).catch(() => null) : null
  const qrImg = qrBytes ? await pdfDoc.embedPng(qrBytes).catch(() => null) : null

  // Every page drawn gets tracked here so a running header/footer (doc
  // title, small logo, page count) can be stamped across the whole document
  // in one pass at the end — the total page count isn't known until then,
  // so per-page "Page X / Y" numbering has to happen after the fact.
  const allPages: import('pdf-lib').PDFPage[] = []

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  allPages.push(page)
  let y = PAGE_HEIGHT - MARGIN

  const docTitle = `${isContract ? 'Contrat' : 'Devis'} ${quote.numero}`

  // Compact repeated header for every page after the first — a multi-page
  // contract (up to 19 articles) would otherwise start page 2, 3, … with
  // bare body text and no indication of which document or page the reader
  // is on. The full masthead (big logo, role, access-code badge) stays
  // page-1-only; this is deliberately smaller so it doesn't compete with it.
  function drawContinuationHeader() {
    const topY = PAGE_HEIGHT - MARGIN
    if (logoImg) {
      page.drawImage(logoImg, { x: MARGIN, y: topY - 16, width: 16, height: 16 })
    }
    const nameX = logoImg ? MARGIN + 22 : MARGIN
    page.drawText(safeText(personal.name), { x: nameX, y: topY - 12, size: 9, font: fontBold, color: INK })
    const titleW = fontRegular.widthOfTextAtSize(docTitle, 8)
    page.drawText(safeText(docTitle), { x: PAGE_WIDTH - MARGIN - titleW, y: topY - 12, size: 8, font: fontRegular, color: SUBTLE })
    page.drawLine({ start: { x: MARGIN, y: topY - 22 }, end: { x: PAGE_WIDTH - MARGIN, y: topY - 22 }, thickness: 0.5, color: BORDER })
    y = topY - 34
  }

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    allPages.push(page)
    y = PAGE_HEIGHT - MARGIN
    drawContinuationHeader()
  }

  function ensureSpace(height: number) {
    if (y - height < MARGIN) newPage()
  }

  function drawLine() {
    ensureSpace(14)
    y -= 6
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: BORDER })
    y -= 10
  }

  function drawLabel(text: string) {
    ensureSpace(16)
    page.drawText(safeText(text), { x: MARGIN, y: y - 8, size: 8, font: fontBold, color: SUBTLE })
    y -= 16
  }

  function drawParagraph(text: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number } = {}) {
    const size = opts.size ?? 9.5
    const font = opts.font ?? fontRegular
    const color = opts.color ?? MUTED
    const x = opts.x ?? MARGIN
    const maxWidth = opts.maxWidth ?? CONTENT_WIDTH
    const lineHeight = size * 1.45
    for (const line of wrapText(text, font, size, maxWidth)) {
      ensureSpace(lineHeight)
      page.drawText(line, { x, y: y - size, size, font, color })
      y -= lineHeight
    }
  }

  function drawBullets(items: string[], opts: { size?: number } = {}) {
    const size = opts.size ?? 9.5
    const lineHeight = size * 1.5
    const bulletIndent = 12
    for (const item of items) {
      const lines = wrapText(item, fontRegular, size, CONTENT_WIDTH - bulletIndent)
      lines.forEach((line, i) => {
        ensureSpace(lineHeight)
        if (i === 0) page.drawText('-', { x: MARGIN, y: y - size, size, font: fontRegular, color: MUTED })
        page.drawText(line, { x: MARGIN + bulletIndent, y: y - size, size, font: fontRegular, color: MUTED })
        y -= lineHeight
      })
    }
  }

  function drawBlock(block: DocBlock) {
    ensureSpace(20)
    page.drawText(safeText(block.title), { x: MARGIN, y: y - 8.5, size: 8.5, font: fontBold, color: INK })
    y -= 18
    block.paragraphs?.forEach((p) => drawParagraph(p))
    if (block.bullets?.length) drawBullets(block.bullets)
    y -= 6
  }

  // ── Header: logo + name, numero badge ──
  const headerTop = y
  if (logoImg) {
    const logoSize = 32
    page.drawImage(logoImg, { x: MARGIN, y: headerTop - logoSize, width: logoSize, height: logoSize })
  }
  const nameX = logoImg ? MARGIN + 42 : MARGIN
  page.drawText(safeText(personal.name), { x: nameX, y: headerTop - 12, size: 12.5, font: fontBold, color: INK })
  page.drawText(safeText(personal.role), { x: nameX, y: headerTop - 26, size: 8.5, font: fontRegular, color: SUBTLE })

  const badgeText = `N° ${quote.numero}`
  const badgeWidth = fontBold.widthOfTextAtSize(badgeText, 9) + 16
  page.drawRectangle({ x: PAGE_WIDTH - MARGIN - badgeWidth, y: headerTop - 18, width: badgeWidth, height: 16, color: INK })
  page.drawText(safeText(badgeText), { x: PAGE_WIDTH - MARGIN - badgeWidth + 8, y: headerTop - 14, size: 9, font: fontBold, color: WHITE })
  page.drawText(safeText(`Code de suivi : ${quote.accessCode}`), { x: PAGE_WIDTH - MARGIN - Math.max(badgeWidth, 140), y: headerTop - 30, size: 7.5, font: fontRegular, color: SUBTLE })

  y = headerTop - 44
  drawLine()

  // ── Title + dates ──
  page.drawText(safeText(isContract ? 'CONTRAT' : 'DEVIS'), { x: MARGIN, y: y - 26, size: 26, font: fontBold, color: INK })
  page.drawText(safeText(`Date d'émission : ${dateEmission}`), { x: MARGIN + 200, y: y - 12, size: 8.5, font: fontRegular, color: MUTED })
  page.drawText(safeText(`Validité de l'offre : ${quote.validiteJours} jours`), { x: MARGIN + 200, y: y - 24, size: 8.5, font: fontRegular, color: MUTED })
  y -= 40

  // ── Parties ──
  drawLabel('1. PRESTATAIRE')
  drawParagraph(personal.name, { size: 9.5, font: fontBold, color: INK })
  drawParagraph('Développeur freelance')
  drawParagraph(personal.location)
  drawParagraph(personal.email)
  if (personal.whatsapp) drawParagraph(personal.whatsapp)
  y -= 6

  drawLabel('2. CLIENT')
  drawParagraph(quote.clientNom, { size: 9.5, font: fontBold, color: INK })
  if (quote.clientSociete) drawParagraph(quote.clientSociete)
  if (quote.clientAdresse) drawParagraph(quote.clientAdresse)
  if (quote.clientEmail) drawParagraph(quote.clientEmail)
  if (quote.clientTelephone) drawParagraph(quote.clientTelephone)
  y -= 6

  // ── Project ──
  drawLabel('3. PROJET')
  drawParagraph(quote.descriptionProjet)
  y -= 4

  // ── Items table ──
  drawLabel('4. DÉTAIL DES PRESTATIONS')
  const colDesignation = MARGIN
  const colQty = MARGIN + CONTENT_WIDTH - 190
  const colUnit = MARGIN + CONTENT_WIDTH - 130
  const colTotal = MARGIN + CONTENT_WIDTH - 60
  ensureSpace(20)
  page.drawText(safeText('DÉSIGNATION'), { x: colDesignation, y: y - 8, size: 7.5, font: fontBold, color: SUBTLE })
  page.drawText(safeText('QTÉ'), { x: colQty, y: y - 8, size: 7.5, font: fontBold, color: SUBTLE })
  page.drawText('PRIX HT', { x: colUnit, y: y - 8, size: 7.5, font: fontBold, color: SUBTLE })
  page.drawText('TOTAL HT', { x: colTotal, y: y - 8, size: 7.5, font: fontBold, color: SUBTLE })
  y -= 12
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: INK })
  y -= 12

  quote.items.forEach((it, rowIndex) => {
    const lines = wrapText(it.designation, fontRegular, 9, colQty - colDesignation - 8)
    const rowHeight = Math.max(lines.length * 12, 12)
    ensureSpace(rowHeight + 6)
    // Alternating row tint (zebra striping) — drawn after ensureSpace() so it
    // lands on whichever page the row actually ended up on, and before the
    // text so it sits behind it.
    if (rowIndex % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - rowHeight - 2, width: CONTENT_WIDTH, height: rowHeight + 6, color: rgb(0.97, 0.97, 0.97) })
    }
    lines.forEach((line, i) => page.drawText(line, { x: colDesignation, y: y - 9 - i * 12, size: 9, font: fontRegular, color: INK }))
    page.drawText(String(it.quantite), { x: colQty, y: y - 9, size: 9, font: fontRegular, color: MUTED })
    page.drawText(safeText(fmt(it.prixUnitaireHT)), { x: colUnit, y: y - 9, size: 9, font: fontRegular, color: MUTED })
    page.drawText(safeText(fmt(it.quantite * it.prixUnitaireHT)), { x: colTotal, y: y - 9, size: 9, font: fontRegular, color: INK })
    y -= rowHeight + 6
    page.drawLine({ start: { x: MARGIN, y: y + 3 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 3 }, thickness: 0.5, color: BORDER })
  })
  y -= 8

  // ── Totals ──
  const totalsWidth = 220
  const totalsX = PAGE_WIDTH - MARGIN - totalsWidth
  ensureSpace(70)
  const totalsRows: [string, string, boolean][] = [
    ['Total HT', fmt(quote.totalHT), false],
    ['TVA (18%)', fmt(quote.tva), false],
    ['Total TTC', fmt(quote.totalTTC), true],
  ]
  for (const [label, value, emphasis] of totalsRows) {
    const rowH = 20
    page.drawRectangle({ x: totalsX, y: y - rowH, width: totalsWidth, height: rowH, color: emphasis ? INK : rgb(0.96, 0.96, 0.96) })
    page.drawText(safeText(label), { x: totalsX + 10, y: y - rowH + 6, size: 9, font: emphasis ? fontBold : fontRegular, color: emphasis ? WHITE : INK })
    const valueWidth = (emphasis ? fontBold : fontBold).widthOfTextAtSize(value, 9)
    page.drawText(safeText(value), { x: totalsX + totalsWidth - 10 - valueWidth, y: y - rowH + 6, size: 9, font: fontBold, color: emphasis ? WHITE : INK })
    y -= rowH
  }
  y -= 16

  drawLine()

  // ── Numbered sections / articles ──
  for (const block of blocks) drawBlock(block)

  // ── Acceptance / signature ──
  if (quote.signature) {
    drawLabel('SIGNATURE ÉLECTRONIQUE')
    const boxHeight = 156
    ensureSpace(boxHeight)
    const boxTop = y
    page.drawRectangle({ x: MARGIN, y: boxTop - boxHeight, width: CONTENT_WIDTH, height: boxHeight, borderColor: BORDER, borderWidth: 1, color: WHITE })

    let iy = boxTop - 16
    const statusText = 'STATUT : SIGNÉ'
    const statusW = fontBold.widthOfTextAtSize(statusText, 8) + 16
    page.drawRectangle({ x: MARGIN + 12, y: iy - 12, width: statusW, height: 16, color: rgb(0.04, 0.48, 0.18) })
    page.drawText(safeText(statusText), { x: MARGIN + 20, y: iy - 8, size: 8, font: fontBold, color: WHITE })

    iy -= 28
    page.drawText(safeText(`Signé par : ${quote.signature.name}`), { x: MARGIN + 12, y: iy, size: 9, font: fontRegular, color: INK })
    page.drawText(safeText(`E-mail : ${quote.signature.email}`), { x: MARGIN + 300, y: iy, size: 9, font: fontRegular, color: INK })

    iy -= 16
    const signedAtStr = new Date(quote.signature.signedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
    page.drawText(safeText(`Date et heure : ${signedAtStr}`), { x: MARGIN + 12, y: iy, size: 9, font: fontRegular, color: INK })
    page.drawText(safeText(`Document signé : ${quote.numero}`), { x: MARGIN + 300, y: iy, size: 9, font: fontRegular, color: INK })

    iy -= 16
    page.drawText(safeText(`Référence (SHA-256) : ${quote.signature.documentHash.slice(0, 32)}...`), { x: MARGIN + 12, y: iy, size: 7, font: fontRegular, color: SUBTLE })

    // Signature images sit in their own row, well below the metadata above —
    // fixed offsets from boxTop rather than from boxHeight, so this can
    // never silently overlap the text rows if boxHeight is ever tuned.
    const sigLabelY = boxTop - 108
    const sigImageY = sigLabelY - 44
    page.drawText(safeText('Signature du client'), { x: MARGIN + 12, y: sigLabelY, size: 7.5, font: fontRegular, color: SUBTLE })
    if (clientSigImg) {
      const dims = clientSigImg.scale(1)
      const h = 36
      const w = Math.min(160, (dims.width / dims.height) * h)
      page.drawImage(clientSigImg, { x: MARGIN + 12, y: sigImageY, width: w, height: h })
    }
    page.drawText(safeText('Signature du prestataire'), { x: PAGE_WIDTH - MARGIN - 172, y: sigLabelY, size: 7.5, font: fontRegular, color: SUBTLE })
    if (providerSigImg) {
      const dims = providerSigImg.scale(1)
      const h = 36
      const w = Math.min(160, (dims.width / dims.height) * h)
      page.drawImage(providerSigImg, { x: PAGE_WIDTH - MARGIN - w - 12, y: sigImageY, width: w, height: h })
    } else {
      page.drawText(safeText('Signature du prestataire non configurée'), { x: PAGE_WIDTH - MARGIN - 172, y: sigImageY + 18, size: 7.5, font: fontItalic, color: SUBTLE })
    }
    y = boxTop - boxHeight - 16
  } else {
    drawLabel(isContract ? 'ARTICLE 19 — SIGNATURE' : '14. ACCEPTATION DU DEVIS')
    drawParagraph(
      isContract ? 'Commande confirmée — Date et signature du client :' : 'Bon pour accord — Date et signature du client :',
      { font: fontBold, color: INK },
    )
    y -= 24
  }

  drawLine()

  // ── Footer: QR + provider name ──
  ensureSpace(60)
  if (qrImg) page.drawImage(qrImg, { x: MARGIN, y: y - 50, width: 50, height: 50 })
  page.drawText(safeText(personal.name), { x: PAGE_WIDTH - MARGIN - 220, y: y - 14, size: 9.5, font: fontBold, color: INK })
  page.drawText(safeText('Document généré et validé électroniquement'), { x: PAGE_WIDTH - MARGIN - 220, y: y - 26, size: 7.5, font: fontRegular, color: SUBTLE })

  // ── Page numbers ── drawn last, once every page exists, so a multi-page
  // contract reads "Page 2 / 4" rather than being silently unnumbered.
  const total = allPages.length
  allPages.forEach((p, i) => {
    const label = `Page ${i + 1} / ${total}`
    const w = fontRegular.widthOfTextAtSize(label, 7.5)
    p.drawText(label, { x: (PAGE_WIDTH - w) / 2, y: MARGIN - 20, size: 7.5, font: fontRegular, color: SUBTLE })
  })

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
