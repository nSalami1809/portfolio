// Small pdf-lib toolkit shared by every business PDF (devis, contrat, avenant,
// procès-verbal, facture, reçu) — pure pdf-lib, no headless browser, so it
// runs reliably in a Vercel serverless function. Handles the parts that must
// look identical across documents: masthead, running header on continuation
// pages, wrapped text/bullets, item table, totals, and "Page X / Y".
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import type { DocBlock } from '@/lib/quote-document'

export const PAGE_WIDTH = 595.28 // A4 in points
export const PAGE_HEIGHT = 841.89
export const MARGIN = 48
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
export const INK = rgb(0.07, 0.07, 0.07)
export const MUTED = rgb(0.33, 0.33, 0.33)
export const SUBTLE = rgb(0.55, 0.55, 0.55)
export const BORDER = rgb(0.85, 0.85, 0.85)
export const WHITE = rgb(1, 1, 1)
export const SOFT = rgb(0.96, 0.96, 0.96)
export const ZEBRA = rgb(0.97, 0.97, 0.97)

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

// Also folds the two non-breaking spaces (U+00A0 is encodable but U+202F is
// not) into a plain space so amounts formatted by toLocaleString stay intact.
export function safeText(text: string): string {
  return Array.from(text.replace(/[  ]/g, ' '))
    .map((ch) => (isWinAnsiEncodable(ch.codePointAt(0)!) ? ch : '?'))
    .join('')
}

export async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
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

type Color = ReturnType<typeof rgb>

export interface TableRow {
  designation: string
  quantite: number | string
  unit: string
  total: string
}

export interface PdfKit {
  doc: PDFDocument
  fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont }
  // Cursor: the current page and the y coordinate of the next free line.
  state: { page: PDFPage; y: number }
  logo: PDFImage | null
  embedImage(bytes: Uint8Array | null): Promise<PDFImage | null>
  ensureSpace(height: number): void
  drawLine(): void
  drawLabel(text: string): void
  drawParagraph(text: string, opts?: { size?: number; font?: PDFFont; color?: Color; x?: number; maxWidth?: number }): void
  drawBullets(items: string[], opts?: { size?: number }): void
  drawBlock(block: DocBlock): void
  drawMasthead(o: { name: string; role: string; badge: string; sub?: string }): void
  drawTitleRow(title: string, lines: string[], size?: number): void
  drawTable(rows: TableRow[], o: { priceLabel: string; totalLabel: string }): void
  drawSignature(img: PDFImage | null, label: string): void
  drawTotals(rows: [label: string, value: string, emphasis: boolean][]): void
  finish(): Promise<Buffer>
}

interface KitOptions {
  title: string
  producer: string
  // Shown top-left / top-right on every page after the first.
  runningName: string
  runningTitle: string
}

export async function createPdfKit(opts: KitOptions): Promise<PdfKit> {
  const doc = await PDFDocument.create()
  doc.setTitle(opts.title)
  doc.setProducer(opts.producer)

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  }

  // Every page drawn gets tracked here so a running header/footer (doc
  // title, small logo, page count) can be stamped across the whole document
  // in one pass at the end — the total page count isn't known until then,
  // so per-page "Page X / Y" numbering has to happen after the fact.
  const allPages: PDFPage[] = []
  const firstPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  allPages.push(firstPage)
  const state = { page: firstPage, y: PAGE_HEIGHT - MARGIN }

  const kit: PdfKit = {
    doc, fonts, state, logo: null,

    // pdf-lib only reads PNG and JPEG. The upload pipeline stores signatures
    // and logos as WebP, which used to be dropped silently (blank signature
    // box) — anything else is converted to PNG first.
    async embedImage(bytes) {
      if (!bytes) return null
      try {
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
        if (isPng) return await doc.embedPng(bytes)
        if (isJpeg) return await doc.embedJpg(bytes)
        const { default: sharp } = await import('sharp')
        return await doc.embedPng(await sharp(bytes).png().toBuffer())
      } catch (e) {
        console.error('[pdf-kit] image could not be embedded:', e)
        return null
      }
    },

    ensureSpace(height) {
      if (state.y - height < MARGIN) newPage()
    },

    drawLine() {
      kit.ensureSpace(14)
      state.y -= 6
      state.page.drawLine({ start: { x: MARGIN, y: state.y }, end: { x: PAGE_WIDTH - MARGIN, y: state.y }, thickness: 0.75, color: BORDER })
      state.y -= 10
    },

    drawLabel(text) {
      kit.ensureSpace(16)
      state.page.drawText(safeText(text), { x: MARGIN, y: state.y - 8, size: 8, font: fonts.bold, color: SUBTLE })
      state.y -= 16
    },

    drawParagraph(text, o = {}) {
      const size = o.size ?? 9.5
      const font = o.font ?? fonts.regular
      const color = o.color ?? MUTED
      const x = o.x ?? MARGIN
      const maxWidth = o.maxWidth ?? CONTENT_WIDTH
      const lineHeight = size * 1.45
      for (const line of wrapText(text, font, size, maxWidth)) {
        kit.ensureSpace(lineHeight)
        state.page.drawText(line, { x, y: state.y - size, size, font, color })
        state.y -= lineHeight
      }
    },

    drawBullets(items, o = {}) {
      const size = o.size ?? 9.5
      const lineHeight = size * 1.5
      const bulletIndent = 12
      for (const item of items) {
        const lines = wrapText(item, fonts.regular, size, CONTENT_WIDTH - bulletIndent)
        lines.forEach((line, i) => {
          kit.ensureSpace(lineHeight)
          if (i === 0) state.page.drawText('-', { x: MARGIN, y: state.y - size, size, font: fonts.regular, color: MUTED })
          state.page.drawText(line, { x: MARGIN + bulletIndent, y: state.y - size, size, font: fonts.regular, color: MUTED })
          state.y -= lineHeight
        })
      }
    },

    drawBlock(block) {
      kit.ensureSpace(20)
      state.page.drawText(safeText(block.title), { x: MARGIN, y: state.y - 8.5, size: 8.5, font: fonts.bold, color: INK })
      state.y -= 18
      block.paragraphs?.forEach((p) => kit.drawParagraph(p))
      if (block.bullets?.length) kit.drawBullets(block.bullets)
      state.y -= 6
    },

    // Logo + name/role on the left, reference badge on the right.
    drawMasthead({ name, role, badge, sub }) {
      const headerTop = state.y
      if (kit.logo) {
        const logoSize = 32
        state.page.drawImage(kit.logo, { x: MARGIN, y: headerTop - logoSize, width: logoSize, height: logoSize })
      }
      const nameX = kit.logo ? MARGIN + 42 : MARGIN
      state.page.drawText(safeText(name), { x: nameX, y: headerTop - 12, size: 12.5, font: fonts.bold, color: INK })
      state.page.drawText(safeText(role), { x: nameX, y: headerTop - 26, size: 8.5, font: fonts.regular, color: SUBTLE })

      const badgeWidth = fonts.bold.widthOfTextAtSize(safeText(badge), 9) + 16
      state.page.drawRectangle({ x: PAGE_WIDTH - MARGIN - badgeWidth, y: headerTop - 18, width: badgeWidth, height: 16, color: INK })
      state.page.drawText(safeText(badge), { x: PAGE_WIDTH - MARGIN - badgeWidth + 8, y: headerTop - 14, size: 9, font: fonts.bold, color: WHITE })
      if (sub) {
        state.page.drawText(safeText(sub), { x: PAGE_WIDTH - MARGIN - Math.max(badgeWidth, 140), y: headerTop - 30, size: 7.5, font: fonts.regular, color: SUBTLE })
      }
      state.y = headerTop - 44
      kit.drawLine()
    },

    drawTitleRow(title, lines, size = 26) {
      kit.ensureSpace(48)
      const safeTitle = safeText(title)
      state.page.drawText(safeTitle, { x: MARGIN, y: state.y - size, size, font: fonts.bold, color: INK })
      const linesX = Math.max(MARGIN + 250, MARGIN + fonts.bold.widthOfTextAtSize(safeTitle, size) + 24)
      lines.forEach((line, i) => {
        state.page.drawText(safeText(line), { x: linesX, y: state.y - 12 - i * 12, size: 8.5, font: fonts.regular, color: MUTED })
      })
      state.y -= size + 14
    },

    drawTable(rows, { priceLabel, totalLabel }) {
      const colDesignation = MARGIN
      const colQty = MARGIN + CONTENT_WIDTH - 190
      const colUnit = MARGIN + CONTENT_WIDTH - 130
      const colTotal = MARGIN + CONTENT_WIDTH - 60
      kit.ensureSpace(20)
      const head = (text: string, x: number) => state.page.drawText(safeText(text), { x, y: state.y - 8, size: 7.5, font: fonts.bold, color: SUBTLE })
      head('DÉSIGNATION', colDesignation)
      head('QTÉ', colQty)
      head(priceLabel, colUnit)
      head(totalLabel, colTotal)
      state.y -= 12
      state.page.drawLine({ start: { x: MARGIN, y: state.y }, end: { x: PAGE_WIDTH - MARGIN, y: state.y }, thickness: 1, color: INK })
      state.y -= 12

      rows.forEach((row, rowIndex) => {
        const lines = wrapText(row.designation, fonts.regular, 9, colQty - colDesignation - 8)
        const rowHeight = Math.max(lines.length * 12, 12)
        kit.ensureSpace(rowHeight + 6)
        // Alternating row tint (zebra striping) — drawn after ensureSpace() so
        // it lands on whichever page the row actually ended up on, and before
        // the text so it sits behind it.
        if (rowIndex % 2 === 1) {
          state.page.drawRectangle({ x: MARGIN, y: state.y - rowHeight - 2, width: CONTENT_WIDTH, height: rowHeight + 6, color: ZEBRA })
        }
        lines.forEach((line, i) => state.page.drawText(line, { x: colDesignation, y: state.y - 9 - i * 12, size: 9, font: fonts.regular, color: INK }))
        state.page.drawText(safeText(String(row.quantite)), { x: colQty, y: state.y - 9, size: 9, font: fonts.regular, color: MUTED })
        state.page.drawText(safeText(row.unit), { x: colUnit, y: state.y - 9, size: 9, font: fonts.regular, color: MUTED })
        state.page.drawText(safeText(row.total), { x: colTotal, y: state.y - 9, size: 9, font: fonts.regular, color: INK })
        state.y -= rowHeight + 6
        state.page.drawLine({ start: { x: MARGIN, y: state.y + 3 }, end: { x: PAGE_WIDTH - MARGIN, y: state.y + 3 }, thickness: 0.5, color: BORDER })
      })
      state.y -= 8
    },

    // A captioned signature image, left-aligned in the flow (no-op without one).
    drawSignature(img, label) {
      if (!img) return
      kit.ensureSpace(64)
      state.page.drawText(safeText(label), { x: MARGIN, y: state.y - 8, size: 7.5, font: fonts.regular, color: SUBTLE })
      const dims = img.scale(1)
      const h = 36
      state.page.drawImage(img, { x: MARGIN, y: state.y - 14 - h, width: Math.min(160, (dims.width / dims.height) * h), height: h })
      state.y -= 14 + h + 10
    },

    drawTotals(rows) {
      const totalsWidth = 220
      const totalsX = PAGE_WIDTH - MARGIN - totalsWidth
      kit.ensureSpace(rows.length * 20 + 10)
      for (const [label, value, emphasis] of rows) {
        const rowH = 20
        state.page.drawRectangle({ x: totalsX, y: state.y - rowH, width: totalsWidth, height: rowH, color: emphasis ? INK : SOFT })
        state.page.drawText(safeText(label), { x: totalsX + 10, y: state.y - rowH + 6, size: 9, font: emphasis ? fonts.bold : fonts.regular, color: emphasis ? WHITE : INK })
        const valueWidth = fonts.bold.widthOfTextAtSize(safeText(value), 9)
        state.page.drawText(safeText(value), { x: totalsX + totalsWidth - 10 - valueWidth, y: state.y - rowH + 6, size: 9, font: fonts.bold, color: emphasis ? WHITE : INK })
        state.y -= rowH
      }
      state.y -= 16
    },

    async finish() {
      // Page numbers drawn last, once every page exists, so a multi-page
      // document reads "Page 2 / 4" rather than being silently unnumbered.
      const total = allPages.length
      allPages.forEach((p, i) => {
        const label = `Page ${i + 1} / ${total}`
        const w = fonts.regular.widthOfTextAtSize(label, 7.5)
        p.drawText(label, { x: (PAGE_WIDTH - w) / 2, y: MARGIN - 20, size: 7.5, font: fonts.regular, color: SUBTLE })
      })
      return Buffer.from(await doc.save())
    },
  }

  // Compact repeated header for every page after the first — a multi-page
  // contract would otherwise start page 2, 3, … with bare body text and no
  // indication of which document or page the reader is on. The full masthead
  // (big logo, role, reference badge) stays page-1-only.
  function newPage() {
    state.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    allPages.push(state.page)
    const topY = PAGE_HEIGHT - MARGIN
    if (kit.logo) state.page.drawImage(kit.logo, { x: MARGIN, y: topY - 16, width: 16, height: 16 })
    const nameX = kit.logo ? MARGIN + 22 : MARGIN
    state.page.drawText(safeText(opts.runningName), { x: nameX, y: topY - 12, size: 9, font: fonts.bold, color: INK })
    const title = safeText(opts.runningTitle)
    const titleW = fonts.regular.widthOfTextAtSize(title, 8)
    state.page.drawText(title, { x: PAGE_WIDTH - MARGIN - titleW, y: topY - 12, size: 8, font: fonts.regular, color: SUBTLE })
    state.page.drawLine({ start: { x: MARGIN, y: topY - 22 }, end: { x: PAGE_WIDTH - MARGIN, y: topY - 22 }, thickness: 0.5, color: BORDER })
    state.y = topY - 34
  }

  return kit
}
