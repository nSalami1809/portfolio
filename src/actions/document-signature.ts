'use server'

import { createHash } from 'crypto'
import sharp from 'sharp'
import { requireAdmin } from '@/lib/require-admin'
import { fetchPortfolioSafe } from '@/actions/portfolio'
import { previewDocxSignatures, signDocxDocument, type SignaturePlaceholder } from '@/lib/docx-signature'

export type { SignaturePlaceholder }

export type PreviewResult =
  | { ok: true; matches: SignaturePlaceholder[] }
  | { ok: false; error: string }

export type GenerateResult =
  | { ok: true; fileBase64: string; filename: string }
  | { ok: false; error: string }

/** Reads a .docx (sent as base64 from the admin's browser) and lists every place the word "signature" appears. */
export async function previewSignaturePlaceholders(fileBase64: string): Promise<PreviewResult> {
  await requireAdmin()
  try {
    const bytes = Buffer.from(fileBase64, 'base64')
    const matches = await previewDocxSignatures(bytes)
    if (!matches.length) return { ok: false, error: 'Aucune occurrence du mot « signature » trouvée dans ce document.' }
    return { ok: true, matches }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Document Word illisible ou invalide.' }
  }
}

/** Stamps the configured signature (+ a proof block) at the selected matches and returns the signed .docx. */
export async function generateSignedDocx(fileBase64: string, originalFilename: string, selectedIds: string[]): Promise<GenerateResult> {
  await requireAdmin()
  if (!selectedIds.length) return { ok: false, error: 'Sélectionnez au moins un emplacement à signer.' }

  try {
    const portfolio = await fetchPortfolioSafe('generateSignedDocx')
    const personal = portfolio?.personal
    const signatureUrl = personal?.signatureUrl
    if (!signatureUrl) {
      return { ok: false, error: "Aucune signature configurée — ajoutez-la d'abord dans Profil & Réseaux." }
    }

    const imgRes = await fetch(signatureUrl)
    if (!imgRes.ok) return { ok: false, error: 'Impossible de récupérer la signature enregistrée.' }
    const rawImageBytes = new Uint8Array(await imgRes.arrayBuffer())

    // The upload pipeline stores signatures as WebP — Word doesn't reliably
    // support that in a <a:blip>, so always normalize to PNG before embedding.
    const pngBytes = await sharp(rawImageBytes).png().toBuffer()
    const metadata = await sharp(pngBytes).metadata()
    if (!metadata.width || !metadata.height) return { ok: false, error: 'Image de signature invalide.' }

    const fileBytes = Buffer.from(fileBase64, 'base64')
    const signedAt = new Date()
    const hash = createHash('sha256')
      .update(fileBytes)
      .update(JSON.stringify({ selectedIds, signedAt: signedAt.toISOString(), signer: personal?.name ?? '' }))
      .digest('hex')
    const dateStr = signedAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' })
    const proofText = `Signé électroniquement par ${personal?.name || 'le prestataire'} — ${dateStr} — Preuve (SHA-256) : ${hash.slice(0, 16)}…`

    const signed = await signDocxDocument(
      fileBytes,
      selectedIds,
      { pngBytes, width: metadata.width, height: metadata.height },
      proofText,
    )

    const base = originalFilename.replace(/\.docx$/i, '') || 'document'
    return { ok: true, fileBase64: Buffer.from(signed).toString('base64'), filename: `${base}-signe.docx` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur lors de la génération du document.' }
  }
}
