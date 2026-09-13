'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { usePortfolio } from '@/providers/PortfolioContext'
import { buildDevisBlocks, buildContractBlocks, type DocBlock } from '@/lib/quote-document'
import { downloadQuotePdf, type Quote } from '@/actions/quotes'

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

interface Props {
  quote: Quote
  onClose: () => void
  // 'contrat' is shown once a quote has been accepted — same document, the
  // client's proof of an agreed order rather than a pending proposal.
  variant?: 'devis' | 'contrat'
}

function DocBlockView({ block }: { block: DocBlock }) {
  return (
    <div style={{ marginBottom: '1.4rem', breakInside: 'avoid' }}>
      <p style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.05em', color: '#111111', marginBottom: 7 }}>
        {block.title}
      </p>
      {block.paragraphs?.map((p, i) => (
        <p key={i} style={{ fontSize: '0.82rem', color: '#333333', lineHeight: 1.7, marginBottom: 8 }}>{p}</p>
      ))}
      {block.bullets && block.bullets.length > 0 && (
        <ul style={{ fontSize: '0.82rem', color: '#333333', paddingLeft: '1.15rem', lineHeight: 1.8, marginBottom: 4 }}>
          {block.bullets.map((b, i) => <li key={i} style={{ marginBottom: 3 }}>{b}</li>)}
        </ul>
      )}
    </div>
  )
}

export default function QuoteView({ quote, onClose, variant = 'devis' }: Props) {
  const isContract = variant === 'contrat'
  const { data } = usePortfolio()
  const { personal } = data
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

  useEffect(() => {
    QRCode.toDataURL(siteUrl, { margin: 1, width: 200, color: { dark: '#111111', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [siteUrl])

  useEscapeKey(true, onClose)

  // This overlay scrolls internally; without locking the page behind it, a
  // touch that starts outside the document scrolls the page under the modal.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  const dateEmission = new Date(quote.dateEmission).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

  const blocks = isContract ? buildContractBlocks(quote, personal) : buildDevisBlocks(quote)

  // Server-rendered PDF (pdf-lib, real text + running header + page
  // numbers) — the same document the emailed attachment uses, rather than a
  // client-side html2canvas screenshot sliced into pages, which used to cut
  // table rows and paragraphs in half wherever a page boundary landed.
  const handleDownloadPdf = async () => {
    if (downloading) return
    setDownloading(true)
    setDownloadError('')
    try {
      const result = await downloadQuotePdf(quote.accessCode)
      if (!result.ok) {
        setDownloadError(result.error)
        return
      }
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('[QuoteView] PDF download error:', e)
      setDownloadError('Une erreur est survenue. Réessayez plus tard.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)', padding: '2rem 1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #quote-print-area, #quote-print-area * { visibility: visible; }
          #quote-print-area { position: absolute; inset: 0; width: 100%; max-width: 100%; box-shadow: none !important; margin: 0 !important; }
          .quote-no-print { display: none !important; }
          .quote-scroll { overflow: visible !important; }
        }
      `}</style>

      <div
        id="quote-print-area"
        style={{
          background: '#ffffff',
          color: '#111111',
          width: '100%',
          maxWidth: 760,
          borderRadius: 0,
          // A flat 2.5rem left only ~248px of usable width on a 360px phone —
          // this modal is also the public signature page's document view, not
          // a print-only sheet.
          padding: 'clamp(1.25rem, 4vw, 2.5rem)',
          fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Toolbar */}
        <div className="quote-no-print flex items-center justify-between flex-wrap gap-3 mb-6">
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="text-sm font-medium"
            style={{ color: '#666', fontFamily: 'var(--font-inter), sans-serif' }}
          >
            ← Fermer
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.print()}
              className="text-sm font-semibold"
              style={{ background: '#ffffff', color: '#111111', border: '1px solid #111111', borderRadius: 0, padding: '0.5rem 1.1rem', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif' }}
            >
              Imprimer
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="text-sm font-semibold"
              style={{ background: '#111111', color: '#fff', borderRadius: 0, padding: '0.5rem 1.1rem', cursor: downloading ? 'default' : 'pointer', opacity: downloading ? 0.7 : 1, fontFamily: 'var(--font-inter), sans-serif' }}
            >
              {downloading ? 'Génération…' : 'Télécharger le PDF'}
            </button>
          </div>
        </div>
        {downloadError && (
          <p className="quote-no-print" style={{ fontSize: '0.8rem', color: '#D90000', marginTop: '-0.75rem', marginBottom: '1rem' }}>
            {downloadError}
          </p>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset, print context */}
            <img src="/logo-black.png" alt="" width={60} height={60} style={{ width: 60, height: 60 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: '1.15rem', fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{personal.name}</p>
              <p style={{ fontSize: '0.8rem', color: '#555' }}>{personal.role}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: '#111111', color: '#fff', padding: '0.35rem 0.9rem', borderRadius: 0, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              N° {quote.numero}
            </div>
            <p style={{ fontSize: '0.7rem', color: '#888', marginTop: 4 }}>
              Code de suivi : <strong style={{ color: '#333', letterSpacing: '0.05em' }}>{quote.accessCode}</strong>
            </p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #ddd', margin: '1.25rem 0' }} />

        {/* Title + dates */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{isContract ? 'CONTRAT' : 'DEVIS'}</h1>
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#333' }}>
            <p style={{ margin: 0 }}>Date d&apos;émission : <em>{dateEmission}</em></p>
            <p style={{ margin: 0 }}>Validité de l&apos;offre : <strong>{quote.validiteJours} jours</strong></p>
          </div>
        </div>

        {/* 1. Prestataire / 2. Client */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', marginBottom: 6 }}>1. PRESTATAIRE</p>
            <p style={{ fontWeight: 700, margin: 0 }}>{personal.name}</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Développeur freelance</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{personal.location}</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{personal.email}</p>
            {personal.whatsapp && <p style={{ margin: 0, fontSize: '0.85rem' }}>{personal.whatsapp}</p>}
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', marginBottom: 6 }}>2. CLIENT</p>
            <p style={{ fontWeight: 700, margin: 0 }}>{quote.clientNom}</p>
            {quote.clientSociete && <p style={{ margin: 0, fontSize: '0.85rem' }}>{quote.clientSociete}</p>}
            {quote.clientAdresse && <p style={{ margin: 0, fontSize: '0.85rem' }}>{quote.clientAdresse}</p>}
            {quote.clientEmail && <p style={{ margin: 0, fontSize: '0.85rem' }}>{quote.clientEmail}</p>}
            {quote.clientTelephone && <p style={{ margin: 0, fontSize: '0.85rem' }}>{quote.clientTelephone}</p>}
          </div>
        </div>

        {/* 3. Projet */}
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', marginBottom: 6 }}>3. PROJET</p>
        <p style={{ fontSize: '0.85rem', color: '#333', marginBottom: 8, lineHeight: 1.6 }}>{quote.descriptionProjet}</p>

        {/* 4. Détail des prestations */}
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', margin: '1.5rem 0 0.75rem' }}>4. DÉTAIL DES PRESTATIONS</p>
        <div className="quote-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 440, borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #111' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem 0', fontSize: '0.7rem', letterSpacing: '0.06em', color: '#555' }}>DÉSIGNATION</th>
              <th style={{ textAlign: 'center', padding: '0.5rem 0', fontSize: '0.7rem', letterSpacing: '0.06em', color: '#555' }}>QTÉ</th>
              <th style={{ textAlign: 'right', padding: '0.5rem 0', fontSize: '0.7rem', letterSpacing: '0.06em', color: '#555' }}>PRIX UNIT. HT</th>
              <th style={{ textAlign: 'right', padding: '0.5rem 0', fontSize: '0.7rem', letterSpacing: '0.06em', color: '#555' }}>TOTAL HT</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.6rem 0' }}>{it.designation}</td>
                <td style={{ padding: '0.6rem 0', textAlign: 'center' }}>{it.quantite}</td>
                <td style={{ padding: '0.6rem 0', textAlign: 'right' }}>{fmt(it.prixUnitaireHT)}</td>
                <td style={{ padding: '0.6rem 0', textAlign: 'right' }}>{fmt(it.quantite * it.prixUnitaireHT)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Totals */}
        <div className="quote-scroll flex justify-end mt-6 mb-8" style={{ overflowX: 'auto' }}>
          <table style={{ width: 260, maxWidth: '100%', flexShrink: 0, fontSize: '0.85rem' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.4rem 0.8rem', background: '#f5f5f5' }}>Total HT</td>
                <td style={{ padding: '0.4rem 0.8rem', background: '#f5f5f5', textAlign: 'right', fontWeight: 700 }}>{fmt(quote.totalHT)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.4rem 0.8rem', background: '#f5f5f5' }}>TVA (18%)</td>
                <td style={{ padding: '0.4rem 0.8rem', background: '#f5f5f5', textAlign: 'right', fontWeight: 700 }}>{fmt(quote.tva)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.6rem 0.8rem', background: '#111', color: '#fff', fontWeight: 700 }}>Total TTC</td>
                <td style={{ padding: '0.6rem 0.8rem', background: '#111', color: '#fff', textAlign: 'right', fontWeight: 700 }}>{fmt(quote.totalTTC)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Numbered sections / articles */}
        <div style={{ borderTop: '1px solid #ddd', margin: '0 0 1.5rem' }} />
        {blocks.map((block, i) => <DocBlockView key={i} block={block} />)}

        {/* Acceptance */}
        {quote.signature ? (
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', marginBottom: 8 }}>
              SIGNATURE ÉLECTRONIQUE
            </p>
            <div style={{ border: '1px solid #ddd', padding: '1.25rem' }}>
              <p style={{ display: 'inline-block', background: '#0A7A2E', color: '#fff', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0.3rem 0.7rem', marginBottom: 14 }}>
                STATUT : SIGNÉ
              </p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mb-3">
                <p style={{ fontSize: '0.82rem', color: '#333' }}><strong>Signé par :</strong> {quote.signature.name}</p>
                <p style={{ fontSize: '0.82rem', color: '#333' }}><strong>E-mail :</strong> {quote.signature.email}</p>
                <p style={{ fontSize: '0.82rem', color: '#333' }}>
                  <strong>Date et heure :</strong> {new Date(quote.signature.signedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
                <p style={{ fontSize: '0.82rem', color: '#333' }}><strong>Document signé :</strong> {quote.numero}</p>
              </div>
              <p style={{ fontSize: '0.68rem', color: '#999', marginBottom: 18, wordBreak: 'break-all' }}>
                <strong>Référence de signature (SHA-256) :</strong> {quote.signature.documentHash}
              </p>
              <div className="flex items-end justify-between flex-wrap gap-6">
                <div>
                  <p style={{ fontSize: '0.7rem', color: '#888', marginBottom: 6 }}>Signature du client</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- external blob URL, arbitrary aspect ratio */}
                  <img src={quote.signature.imageUrl} alt={`Signature de ${quote.signature.name}`} style={{ height: 70, display: 'block' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.7rem', color: '#888', marginBottom: 6 }}>Signature du prestataire</p>
                  {personal.signatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external blob URL, arbitrary aspect ratio
                    <img src={personal.signatureUrl} alt={`Signature de ${personal.name}`} style={{ height: 70, display: 'block', marginLeft: 'auto' }} />
                  ) : (
                    <p style={{ fontSize: '0.78rem', color: '#aaa', fontStyle: 'italic' }}>Signature du prestataire non configurée</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', marginBottom: 8 }}>
              {isContract ? 'ARTICLE 19 — SIGNATURE' : '14. ACCEPTATION DU DEVIS'}
            </p>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '2.5rem' }}>
              {isContract ? 'Commande confirmée — Date et signature du client :' : 'Bon pour accord — Date et signature du client :'}
            </p>
          </>
        )}

        <div style={{ borderTop: '1px solid #ddd', margin: '1.25rem 0' }} />

        {/* QR + signature */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div style={{ textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL generated client-side */}
            {qrDataUrl && <img src={qrDataUrl} alt="QR code vers le portfolio" width={90} height={90} />}
            <p style={{ fontSize: '0.7rem', color: '#888', marginTop: 4 }}>Scannez pour découvrir mon portfolio</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontWeight: 700, margin: 0 }}>{personal.name}</p>
            <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>Signature numérique — document généré et validé électroniquement</p>
          </div>
        </div>
      </div>
    </div>
  )
}
