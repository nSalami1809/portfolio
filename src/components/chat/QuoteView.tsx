'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { usePortfolio } from '@/providers/PortfolioContext'
import type { Quote } from '@/actions/quotes'

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

interface Props {
  quote: Quote
  onClose: () => void
}

export default function QuoteView({ quote, onClose }: Props) {
  const { data } = usePortfolio()
  const { personal, socials } = data
  const [qrDataUrl, setQrDataUrl] = useState('')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

  useEffect(() => {
    QRCode.toDataURL(siteUrl, { margin: 1, width: 200, color: { dark: '#111111', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [siteUrl])

  const dateEmission = new Date(quote.dateEmission).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

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
        }
      `}</style>

      <div
        id="quote-print-area"
        style={{
          background: '#ffffff',
          color: '#111111',
          width: '100%',
          maxWidth: 760,
          borderRadius: 12,
          padding: '2.5rem',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* Toolbar */}
        <div className="quote-no-print flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="text-sm font-medium"
            style={{ color: '#666' }}
          >
            ← Fermer
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm font-semibold rounded-lg"
            style={{ background: '#111111', color: '#fff', padding: '0.5rem 1.1rem', cursor: 'pointer' }}
          >
            Imprimer / Télécharger en PDF
          </button>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset, print context */}
            <img src="/logo-black.png" alt="" width={60} height={60} style={{ width: 60, height: 60 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: '1.15rem' }}>{personal.name}</p>
              <p style={{ fontSize: '0.8rem', color: '#555' }}>{personal.role}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: '#111111', color: '#fff', padding: '0.35rem 0.9rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
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
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>DEVIS</h1>
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#333' }}>
            <p style={{ margin: 0 }}>Date d&apos;émission : <em>{dateEmission}</em></p>
            <p style={{ margin: 0 }}>Validité de l&apos;offre : <strong>{quote.validiteJours} jours</strong></p>
          </div>
        </div>

        {/* Émis par / Adressé à */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', marginBottom: 6 }}>ÉMIS PAR</p>
            <p style={{ fontWeight: 700, margin: 0 }}>{personal.name}</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Développeur freelance</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{personal.location}</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{personal.email}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', marginBottom: 6 }}>ADRESSÉ À</p>
            <p style={{ fontWeight: 700, margin: 0 }}>{quote.clientNom}</p>
            {quote.clientSociete && <p style={{ margin: 0, fontSize: '0.85rem' }}>{quote.clientSociete}</p>}
            {quote.clientAdresse && <p style={{ margin: 0, fontSize: '0.85rem' }}>{quote.clientAdresse}</p>}
            {quote.clientEmail && <p style={{ margin: 0, fontSize: '0.85rem' }}>{quote.clientEmail}</p>}
            {quote.clientTelephone && <p style={{ margin: 0, fontSize: '0.85rem' }}>{quote.clientTelephone}</p>}
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: '0.85rem', color: '#333', marginBottom: 8, lineHeight: 1.6 }}>{quote.descriptionProjet}</p>

        {/* Table */}
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', margin: '1.5rem 0 0.75rem' }}>DÉTAIL DE LA PRESTATION</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
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

        {/* Totals */}
        <div className="flex justify-end mt-6 mb-8">
          <table style={{ width: 260, fontSize: '0.85rem' }}>
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

        {/* Conditions */}
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', marginBottom: 8 }}>CONDITIONS</p>
        <ul style={{ fontSize: '0.8rem', color: '#333', paddingLeft: '1.1rem', marginBottom: '1.5rem', lineHeight: 1.8 }}>
          <li>Acompte de 30% à la commande, solde à la livraison.</li>
          <li>Devis valable {quote.validiteJours} jours à compter de la date d&apos;émission.</li>
          <li>Délai de réalisation à convenir après validation du devis.</li>
        </ul>

        <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '2.5rem' }}>Bon pour accord — Date et signature du client :</p>

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

        <div style={{ borderTop: '1px solid #ddd', margin: '1.25rem 0' }} />

        <p style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center', margin: 0 }}>
          {siteUrl.replace(/^https?:\/\//, '')} · {personal.email}
        </p>
        {(socials.github || socials.linkedin) && (
          <p style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center', margin: '2px 0 0' }}>
            {socials.github && `GitHub — ${socials.github.replace(/^https?:\/\//, '')}`}
            {socials.github && socials.linkedin && ' · '}
            {socials.linkedin && `LinkedIn — ${socials.linkedin.replace(/^https?:\/\//, '')}`}
          </p>
        )}
      </div>
    </div>
  )
}
