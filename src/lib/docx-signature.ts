// Stamps the portfolio owner's signature image (+ a proof block) into an
// arbitrary uploaded .docx wherever a "signature spot" is found. Works by
// splicing raw OOXML strings rather than going through a generic XML DOM,
// so every byte of the original document that isn't touched survives
// untouched (formatting, styles, unrelated namespaces…).
//
// A "signature spot" is a run whose text contains, case/accent-insensitively,
// the word "signature" OR one of the caller-supplied triggers (typically the
// admin's own name and surname) — real contracts often mark the place to
// sign with the signatory's printed name under a "Pour le Prestataire" label
// rather than the literal word "signature", so matching on the word alone
// misses those. Precision is handled downstream by the admin picking which
// matches to actually stamp, so recall is favored here.
//
// Scope (v1, deliberately): only `word/document.xml` (not headers/footers),
// and only matches where the whole trigger sits inside a single `<w:t>` run
// — the common case for a document that wasn't spell-checked into fragments.
// Nothing is inserted mid-word: the matched run is left untouched and a
// signature image run is appended right after it, with a small proof
// paragraph appended after the enclosing paragraph.
import JSZip from 'jszip'

export interface SignaturePlaceholder {
  id: string
  snippet: string
}

interface InternalMatch extends SignaturePlaceholder {
  runEndOffset: number
  paragraphEndOffset: number
  alignment: string | null
}

const EMU_PER_CM = 360000
const MAX_WIDTH_EMU = 3.2 * EMU_PER_CM

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function escapeXmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function stripTags(xml: string): string {
  return decodeXmlEntities(xml.replace(/<[^>]+>/g, ''))
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Default trigger is always "signature"; callers add the admin's own name/surname. */
export function buildSignatureTriggers(fullName?: string): string[] {
  const triggers = new Set<string>(['signature'])
  const trimmed = fullName?.trim()
  if (trimmed) {
    triggers.add(trimmed)
    const surname = trimmed.split(/\s+/).pop()
    if (surname && surname.length >= 3) triggers.add(surname)
  }
  return [...triggers]
}

function extractRunText(runXml: string): string {
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g
  let combined = ''
  let m: RegExpExecArray | null
  while ((m = re.exec(runXml))) combined += decodeXmlEntities(m[1])
  return combined
}

function buildSnippet(paragraphText: string, runText: string): string {
  const text = paragraphText.replace(/\s+/g, ' ').trim()
  if (text.length <= 160) return text
  const at = text.toLowerCase().indexOf(runText.toLowerCase().trim())
  const center = at >= 0 ? at : 0
  const start = Math.max(0, center - 60)
  const end = Math.min(text.length, center + 100)
  return `${start > 0 ? '… ' : ''}${text.slice(start, end)}${end < text.length ? ' …' : ''}`
}

// Runs and paragraphs never nest in OOXML, so a non-greedy scan for the
// closing tag is safe — no need for a real XML parser.
function findSignaturePlaceholders(xml: string, triggers: string[]): InternalMatch[] {
  const normalizedTriggers = triggers.map(normalize)
  const matches: InternalMatch[] = []
  const paraRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
  let paraMatch: RegExpExecArray | null
  let idx = 0
  while ((paraMatch = paraRe.exec(xml))) {
    const paraStart = paraMatch.index
    const paraXml = paraMatch[0]
    const paragraphEndOffset = paraStart + paraXml.length
    const paraText = stripTags(paraXml)
    // Carried over to the proof paragraph so it lines up the same way as the
    // column it's replying to (these signature blocks are usually centered).
    const alignment = /<w:jc\b[^>]*w:val="([^"]+)"/.exec(paraXml)?.[1] ?? null

    const runRe = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g
    let runMatch: RegExpExecArray | null
    while ((runMatch = runRe.exec(paraXml))) {
      const runText = extractRunText(runMatch[0])
      if (!runText.trim()) continue
      const normalizedRunText = normalize(runText)
      if (!normalizedTriggers.some((t) => normalizedRunText.includes(t))) continue
      matches.push({
        id: String(idx++),
        snippet: buildSnippet(paraText, runText),
        runEndOffset: paraStart + runMatch.index + runMatch[0].length,
        paragraphEndOffset,
        alignment,
      })
    }
  }
  return matches
}

function buildDrawingRunXml(relId: string, cx: number, cy: number, docPrId: number): string {
  return (
    // The line break puts the image on its own line, right below whatever
    // matched (a name, a label…) instead of trailing it on the same line —
    // that's what makes it read as a signature under a printed name rather
    // than an odd inline afterthought.
    '<w:r><w:rPr/><w:br/><w:drawing xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
    `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    `<wp:docPr id="${docPrId}" name="Signature"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="Signature"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  )
}

function buildProofParagraphXml(proofText: string, alignment: string | null): string {
  const jc = alignment ? `<w:jc w:val="${alignment}"/>` : ''
  return (
    `<w:p><w:pPr><w:spacing w:before="120"/>${jc}</w:pPr>` +
    '<w:r><w:rPr><w:i/><w:sz w:val="16"/><w:color w:val="808080"/></w:rPr>' +
    `<w:t xml:space="preserve">${escapeXmlText(proofText)}</w:t></w:r></w:p>`
  )
}

function stampXml(xml: string, selectedIds: string[], triggers: string[], opts: { relId: string; cx: number; cy: number; proofText: string }): string {
  const matches = findSignaturePlaceholders(xml, triggers)
  const selectedSet = new Set(selectedIds)
  const selected = matches.filter((m) => selectedSet.has(m.id))
  if (!selected.length) return xml

  const insertions: { offset: number; text: string }[] = []
  const proofInsertedAt = new Set<number>()
  let docPrId = 900001

  for (const m of selected) {
    insertions.push({ offset: m.runEndOffset, text: buildDrawingRunXml(opts.relId, opts.cx, opts.cy, docPrId++) })
    if (!proofInsertedAt.has(m.paragraphEndOffset)) {
      proofInsertedAt.add(m.paragraphEndOffset)
      insertions.push({ offset: m.paragraphEndOffset, text: buildProofParagraphXml(opts.proofText, m.alignment) })
    }
  }

  // Apply from the end of the document backwards so earlier offsets (computed
  // against the original string) stay valid as we splice.
  insertions.sort((a, b) => b.offset - a.offset)
  let out = xml
  for (const ins of insertions) out = out.slice(0, ins.offset) + ins.text + out.slice(ins.offset)
  return out
}

function nextRelationshipId(relsXml: string): string {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))
  return `rId${ids.length ? Math.max(...ids) + 1 : 1}`
}

/** Parses `word/document.xml` out of the .docx and returns every signature-spot match, in document order. */
export async function previewDocxSignatures(
  fileBytes: Uint8Array | Buffer,
  triggers: string[] = ['signature'],
): Promise<SignaturePlaceholder[]> {
  const zip = await JSZip.loadAsync(fileBytes)
  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error("Document Word invalide (contenu illisible) — vérifiez qu'il s'agit bien d'un .docx.")
  const xml = await docFile.async('string')
  return findSignaturePlaceholders(xml, triggers).map(({ id, snippet }) => ({ id, snippet }))
}

/**
 * Stamps the given PNG signature image (already normalized — caller decides
 * format) at every selected match, plus a proof paragraph, and returns the
 * regenerated .docx bytes.
 */
export async function signDocxDocument(
  fileBytes: Uint8Array | Buffer,
  selectedIds: string[],
  signatureImage: { pngBytes: Uint8Array | Buffer; width: number; height: number },
  proofText: string,
  triggers: string[] = ['signature'],
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(fileBytes)
  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error('Document Word invalide.')
  const xml = await docFile.async('string')

  const ratio = signatureImage.height / signatureImage.width
  const cx = Math.round(MAX_WIDTH_EMU)
  const cy = Math.round(MAX_WIDTH_EMU * ratio)

  const relsPath = 'word/_rels/document.xml.rels'
  const relsFile = zip.file(relsPath)
  const relsXml = relsFile
    ? await relsFile.async('string')
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
  const relId = nextRelationshipId(relsXml)
  const mediaName = `signature-electronique-${relId}.png`
  const updatedRelsXml = relsXml.replace(
    '</Relationships>',
    `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
  )

  const ctPath = '[Content_Types].xml'
  const ctFile = zip.file(ctPath)
  let ctXml = ctFile
    ? await ctFile.async('string')
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  if (!/Extension="png"/i.test(ctXml)) {
    ctXml = ctXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
  }

  const stampedXml = stampXml(xml, selectedIds, triggers, { relId, cx, cy, proofText })

  zip.file('word/document.xml', stampedXml)
  zip.file(relsPath, updatedRelsXml)
  zip.file(ctPath, ctXml)
  zip.file(`word/media/${mediaName}`, signatureImage.pngBytes)

  return zip.generateAsync({ type: 'uint8array' })
}
