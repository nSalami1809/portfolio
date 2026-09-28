import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { previewDocxSignatures, signDocxDocument, buildSignatureTriggers } from '@/lib/docx-signature'

// A minimal but valid .docx: just enough of the OOXML package for the
// signature stamper to find and modify (document.xml, its rels, content
// types) — real Word output has far more, but the stamper only ever touches
// these parts and must not choke on a minimal one.
function buildMinimalDocx(paragraphs: string[]): Promise<Uint8Array> {
  return buildDocxWithRawParagraphs(
    paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`),
  )
}

function buildDocxWithRawParagraphs(rawParagraphs: string[]): Promise<Uint8Array> {
  const body = rawParagraphs.join('')
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}</w:body></w:document>`

  const relsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>'

  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>'

  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypesXml)
  zip.file('word/document.xml', documentXml)
  zip.file('word/_rels/document.xml.rels', relsXml)
  return zip.generateAsync({ type: 'uint8array' })
}

// A tiny 1x1 red PNG.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

describe('docx-signature', () => {
  it('finds every paragraph containing the word "signature", case-insensitively', async () => {
    const docx = await buildMinimalDocx([
      'Fait à Libreville, le ____ Signature : ____',
      'Ceci ne parle pas de ce mot.',
      'SIGNATURE du client :',
    ])
    const matches = await previewDocxSignatures(docx)
    expect(matches).toHaveLength(2)
    expect(matches[0].snippet).toContain('Signature')
    expect(matches[1].snippet).toContain('SIGNATURE')
  })

  it('throws a readable error for a non-docx file', async () => {
    await expect(previewDocxSignatures(Buffer.from('not a zip'))).rejects.toThrow()
  })

  it('also matches the admin\'s own name/surname — real contracts often print the name instead of the word "signature"', async () => {
    const docx = await buildMinimalDocx([
      'Pour ESI', 'Yannick EBIBIE', 'Président',
      'Pour le Prestataire', 'Nemrod Nawaf SALAMI',
    ])
    const triggers = buildSignatureTriggers('Nawaf Nemrod SALAMI')
    const matches = await previewDocxSignatures(docx, triggers)
    expect(matches).toHaveLength(1)
    expect(matches[0].snippet).toContain('SALAMI')
    // The other party's name must not be flagged.
    expect(matches.some((m) => m.snippet.includes('EBIBIE'))).toBe(false)
  })

  it('does not match on name alone when no name is configured', async () => {
    const docx = await buildMinimalDocx(['Nemrod Nawaf SALAMI'])
    const matches = await previewDocxSignatures(docx, buildSignatureTriggers(undefined))
    expect(matches).toHaveLength(0)
  })

  it('stamps only the selected matches and leaves the rest of the document untouched', async () => {
    const docx = await buildMinimalDocx([
      'Signature du client :',
      'Signature du prestataire :',
      'Un paragraphe neutre.',
    ])
    const matches = await previewDocxSignatures(docx)
    expect(matches).toHaveLength(2)

    const signed = await signDocxDocument(
      docx,
      [matches[0].id],
      { pngBytes: PNG_1X1, width: 1, height: 1 },
      'Signé électroniquement par Test — preuve abc123',
    )

    const zip = await JSZip.loadAsync(signed)
    const xml = await zip.file('word/document.xml')!.async('string')

    // The stamped paragraph gained a drawing + a proof paragraph right after it.
    expect(xml).toContain('<w:drawing')
    expect(xml).toContain('Signé électroniquement par Test')
    // Only one occurrence was selected, so only one drawing was inserted.
    expect(xml.match(/<w:drawing/g)).toHaveLength(1)
    // The untouched paragraph's text survives verbatim.
    expect(xml).toContain('Un paragraphe neutre.')
    expect(xml).toContain('Signature du prestataire :')

    // Package plumbing was updated: media file, relationship, content type.
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('string')
    expect(relsXml).toMatch(/Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/image"/)
    const mediaFiles = Object.values(zip.files).filter((f) => !f.dir && f.name.startsWith('word/media/'))
    expect(mediaFiles).toHaveLength(1)
    const ctXml = await zip.file('[Content_Types].xml')!.async('string')
    expect(ctXml).toMatch(/Extension="png"/)
  })

  it('puts the image on a new line below the match, and mirrors the paragraph\'s centering on the proof line', async () => {
    const centeredNameParagraph =
      '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">Nemrod Nawaf SALAMI</w:t></w:r></w:p>'
    const docx = await buildDocxWithRawParagraphs([centeredNameParagraph])
    const triggers = buildSignatureTriggers('Nawaf Nemrod SALAMI')
    const matches = await previewDocxSignatures(docx, triggers)
    expect(matches).toHaveLength(1)

    const signed = await signDocxDocument(
      docx,
      [matches[0].id],
      { pngBytes: PNG_1X1, width: 1, height: 1 },
      'Signé électroniquement par Nawaf Nemrod SALAMI',
      triggers,
    )
    const zip = await JSZip.loadAsync(signed)
    const xml = await zip.file('word/document.xml')!.async('string')

    // The break comes before the drawing, inside the run appended right
    // after the name — so the signature renders on its own line under it.
    expect(xml).toMatch(/<w:br\/><w:drawing/)
    // The name's own paragraph keeps its centering untouched…
    expect(xml).toMatch(/<w:jc w:val="center"\/>[\s\S]*Nemrod Nawaf SALAMI/)
    // …and the proof paragraph inherits the same centering, not left-aligned.
    const proofParaMatch = /<w:p><w:pPr><w:spacing w:before="120"\/><w:jc w:val="center"\/><\/w:pPr>[\s\S]*?Signé électroniquement/.exec(xml)
    expect(proofParaMatch).not.toBeNull()
  })

  it('is a no-op when no ids are selected', async () => {
    const docx = await buildMinimalDocx(['Signature : ____'])
    const signed = await signDocxDocument(docx, [], { pngBytes: PNG_1X1, width: 1, height: 1 }, 'preuve')
    const zip = await JSZip.loadAsync(signed)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).not.toContain('<w:drawing')
  })
})
