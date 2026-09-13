'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { usePortfolio } from '@/providers/PortfolioContext'
import type { Quote } from '@/actions/quotes'

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

interface Props {
  quote: Quote
  onClose: () => void
  // 'contrat' is shown once a quote has been accepted — same document, the
  // client's proof of an agreed order rather than a pending proposal.
  variant?: 'devis' | 'contrat'
}

// One numbered section (devis) or article (contrat) of the legal document —
// content is generated from real quote/personal data, never from placeholder
// brackets, so nothing shown to the client is a "[à compléter]" stub.
interface DocBlock {
  title: string
  paragraphs?: string[]
  bullets?: string[]
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

  useEffect(() => {
    QRCode.toDataURL(siteUrl, { margin: 1, width: 200, color: { dark: '#111111', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [siteUrl])

  const dateEmissionDate = new Date(quote.dateEmission)
  const dateEmission = dateEmissionDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  const expiryDate = new Date(dateEmissionDate)
  expiryDate.setDate(expiryDate.getDate() + quote.validiteJours)
  const expiryStr = expiryDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

  const acompte = Math.round(quote.totalTTC * 0.3)
  const solde = quote.totalTTC - acompte
  const ville = personal.location || 'Libreville'
  const pays = ville.split(',').pop()?.trim() || 'Gabon'
  const itemDesignations = quote.items.map((it) => it.designation)

  // ── 14-section devis (numbered exactly as a French informatique services
  // quote) — sections 1-4 are the header/parties/table already rendered
  // above; this covers 5-13, section 14 being the acceptance block below. ──
  const devisBlocks: DocBlock[] = [
    {
      title: '5. LIVRABLES',
      paragraphs: ['La prestation comprend notamment :'],
      bullets: [
        ...itemDesignations,
        'Tests et corrections avant livraison finale',
        'Accompagnement à la mise en ligne',
      ],
    },
    {
      title: '6. TECHNOLOGIES',
      paragraphs: [
        "Les technologies (frontend, backend, base de données, hébergement) seront choisies selon les besoins techniques du projet et pourront être ajustées en concertation avec le Client, sans incidence sur le prix convenu tant que le périmètre de la prestation reste inchangé.",
      ],
    },
    {
      title: '7. DÉLAI ESTIMATIF',
      paragraphs: [
        "Le délai de réalisation sera fixé d'un commun accord avec le Client à la validation du présent devis, en fonction de la disponibilité des contenus, accès et informations nécessaires au projet. Tout retard dans leur transmission pourra entraîner un report équivalent du calendrier.",
      ],
    },
    {
      title: '8. MODALITÉS DE PAIEMENT',
      bullets: [
        `Acompte de 30 % à la commande : ${fmt(acompte)}`,
        `Solde de 70 % à la livraison finale : ${fmt(solde)}`,
        `Total : ${fmt(quote.totalTTC)} TTC`,
      ],
      paragraphs: ["Le développement débute après réception de l'acompte."],
    },
    {
      title: '9. HÉBERGEMENT ET SERVICES TIERS',
      paragraphs: [
        "Sauf mention contraire, les services externes nécessaires à l'exploitation de la solution (nom de domaine, hébergement, API tierces, services d'envoi d'e-mails ou de SMS, stockage cloud, etc.) ne sont pas inclus dans le présent devis et restent à la charge du Client.",
      ],
    },
    {
      title: '10. MAINTENANCE',
      paragraphs: [
        "Le Prestataire assure, pendant une période de 30 jours après la livraison, la correction gracieuse des anomalies liées directement au développement réalisé. Les évolutions, nouvelles fonctionnalités et modifications de périmètre feront l'objet d'un devis complémentaire.",
      ],
    },
    {
      title: '11. ÉLÉMENTS NON INCLUS',
      paragraphs: ["Sauf mention contraire, le présent devis n'inclut pas :"],
      bullets: [
        'Les fonctionnalités demandées après validation du présent devis',
        "Les abonnements à des services tiers, l'hébergement et le nom de domaine",
        'La création de contenus, textes, photographies ou vidéos',
        "Les prestations graphiques non prévues dans le périmètre initial",
        "Les interventions d'un tiers sur le code source",
      ],
    },
    {
      title: '12. PROPRIÉTÉ INTELLECTUELLE',
      paragraphs: [
        "Après paiement intégral de la prestation, les droits sur les éléments spécifiquement développés pour le Client seront définis conformément au contrat de prestation. Les bibliothèques, frameworks, composants génériques et éléments sous licence tierce restent soumis à leurs licences respectives.",
      ],
    },
    {
      title: '13. VALIDITÉ DU DEVIS',
      paragraphs: [
        `Le présent devis est valable ${quote.validiteJours} jours à compter de sa date d'émission, soit jusqu'au ${expiryStr}. Passé ce délai, les prix et conditions pourront être révisés.`,
      ],
    },
  ]

  // ── 19-article contrat de prestation — same underlying quote, framed as a
  // binding agreement once the devis has been accepted. ──
  const contractBlocks: DocBlock[] = [
    {
      title: 'ARTICLE 1 — OBJET DU CONTRAT',
      paragraphs: [
        `Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire réalisera pour le Client la prestation de développement informatique décrite ci-dessus, conformément au devis n° ${quote.numero} du ${dateEmission}, accepté par le Client.`,
        'Nature de la prestation :',
      ],
      bullets: itemDesignations,
    },
    {
      title: 'ARTICLE 2 — DOCUMENTS CONTRACTUELS',
      paragraphs: ['Les documents suivants constituent les éléments contractuels du projet :'],
      bullets: ['Le présent contrat', `Le devis accepté n° ${quote.numero}`, 'Les éventuelles spécifications complémentaires validées par les Parties'],
    },
    {
      title: 'ARTICLE 3 — PÉRIMÈTRE DE LA PRESTATION',
      paragraphs: [
        "Le Prestataire s'engage à réaliser uniquement les prestations expressément prévues dans le devis accepté. Toute fonctionnalité ou prestation supplémentaire demandée après validation pourra faire l'objet d'un devis complémentaire, d'une modification du calendrier et, le cas échéant, d'une facturation additionnelle.",
      ],
    },
    {
      title: 'ARTICLE 4 — DÉLAIS DE RÉALISATION',
      paragraphs: [
        'La prestation débute à réception du premier paiement prévu à l’article 5, sous réserve que le Client fournisse dans les délais nécessaires :',
      ],
      bullets: ['Les contenus, textes et images', 'Les logos et éléments graphiques', 'Les accès et informations techniques nécessaires'],
    },
    {
      title: 'ARTICLE 5 — PRIX ET MODALITÉS DE PAIEMENT',
      paragraphs: [`Le montant total de la prestation est fixé à ${fmt(quote.totalTTC)} TTC (${fmt(quote.totalHT)} HT, TVA 18 % incluse), payable selon l'échéancier suivant :`],
      bullets: [`Acompte de 30 % à la signature du contrat : ${fmt(acompte)}`, `Solde de 70 % à la livraison finale : ${fmt(solde)}`],
    },
    {
      title: 'ARTICLE 6 — VALIDATION ET RECETTE',
      paragraphs: [
        "À la fin du développement, le Prestataire met la solution à disposition du Client pour validation. Le Client dispose d'un délai de 7 jours ouvrés pour signaler toute anomalie relevant du périmètre initial. À défaut de retour dans ce délai, la livraison est considérée comme acceptée.",
      ],
    },
    {
      title: 'ARTICLE 7 — MAINTENANCE ET GARANTIE',
      paragraphs: [
        "Le Prestataire assure, pendant 30 jours après la livraison, la correction des anomalies liées directement au développement réalisé. Cette garantie ne couvre pas les modifications effectuées par un tiers, les problèmes d'hébergement ou de services externes, ni les nouvelles fonctionnalités.",
      ],
    },
    {
      title: 'ARTICLE 8 — HÉBERGEMENT ET SERVICES TIERS',
      paragraphs: [
        'Sauf accord contraire, le Client reste responsable du paiement des services tiers nécessaires à l’exploitation de la solution : hébergement, nom de domaine, API, services de paiement, stockage cloud et autres abonnements.',
      ],
    },
    {
      title: 'ARTICLE 9 — PROPRIÉTÉ INTELLECTUELLE',
      paragraphs: [
        'Après paiement intégral du prix convenu, le Client bénéficie des droits prévus au devis sur les éléments spécifiquement développés pour son projet. Le Prestataire conserve la propriété de ses bibliothèques, composants réutilisables, outils internes et savoir-faire.',
      ],
    },
    {
      title: 'ARTICLE 10 — CODE SOURCE',
      paragraphs: [
        "Après règlement intégral de la prestation, le Prestataire remet au Client, lorsque cela est prévu au devis, le code source, les fichiers nécessaires au déploiement et les accès appartenant au Client.",
      ],
    },
    {
      title: 'ARTICLE 11 — CONFIDENTIALITÉ',
      paragraphs: [
        "Les Parties s'engagent à conserver strictement confidentielles les informations techniques, commerciales ou stratégiques échangées dans le cadre du projet, y compris après la fin du présent contrat.",
      ],
    },
    {
      title: 'ARTICLE 12 — DONNÉES ET SÉCURITÉ',
      paragraphs: [
        "Le Prestataire met en œuvre des mesures raisonnables de sécurité adaptées à la nature du projet. Le Client demeure responsable de la légalité des données qu'il collecte, stocke ou traite avec la solution.",
      ],
    },
    {
      title: 'ARTICLE 13 — RESPONSABILITÉS DU CLIENT',
      paragraphs: ['Le Client s’engage à :'],
      bullets: ['Fournir des informations et contenus exacts', 'Respecter les délais de validation', 'Effectuer les paiements conformément au contrat', 'Signaler rapidement toute anomalie constatée'],
    },
    {
      title: 'ARTICLE 14 — RESPONSABILITÉS DU PRESTATAIRE',
      paragraphs: ['Le Prestataire s’engage à :'],
      bullets: ['Réaliser la prestation conformément au devis accepté', 'Respecter les bonnes pratiques de développement', 'Corriger les anomalies relevant de sa responsabilité pendant la garantie'],
    },
    {
      title: 'ARTICLE 15 — RÉSILIATION',
      paragraphs: [
        "En cas de manquement grave de l'une des Parties, l'autre Partie pourra demander la résiliation du contrat après mise en demeure restée sans effet pendant 15 jours. En cas d'abandon du projet à l'initiative du Client après le début des travaux, les sommes correspondant aux prestations déjà réalisées restent dues.",
      ],
    },
    {
      title: 'ARTICLE 16 — PORTFOLIO ET COMMUNICATION',
      paragraphs: [
        "Sauf opposition écrite du Client, le Prestataire pourra mentionner le projet réalisé dans son portfolio professionnel à des fins de démonstration commerciale, sans jamais publier d'informations confidentielles ou de données personnelles du Client.",
      ],
    },
    {
      title: 'ARTICLE 17 — FORCE MAJEURE',
      paragraphs: [
        "Aucune Partie ne pourra être tenue responsable d'un retard ou d'une inexécution résultant d'un événement indépendant de sa volonté répondant aux conditions de la force majeure.",
      ],
    },
    {
      title: 'ARTICLE 18 — DROIT APPLICABLE ET RÈGLEMENT DES LITIGES',
      paragraphs: [
        `Le présent contrat est soumis au droit en vigueur au ${pays}. En cas de différend, les Parties s'engagent à rechercher en priorité une solution amiable ; à défaut, le litige sera soumis aux juridictions compétentes.`,
      ],
    },
    {
      title: 'ARTICLE 19 — ACCEPTATION DU CONTRAT',
      paragraphs: [
        `La signature du présent contrat vaut acceptation pleine et entière de ses conditions ainsi que du devis n° ${quote.numero} qui lui est annexé. Fait à ${ville}, le ${dateEmission}.`,
      ],
    },
  ]

  const blocks = isContract ? contractBlocks : devisBlocks

  const handleDownloadPdf = async () => {
    const element = document.getElementById('quote-print-area')
    if (!element || downloading) return
    setDownloading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      if (typeof document.fonts?.ready?.then === 'function') await document.fonts.ready

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        ignoreElements: (el) => el.classList.contains('quote-no-print'),
      })

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const imgData = canvas.toDataURL('image/jpeg', 0.95)

      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`${isContract ? 'Contrat' : 'Devis'}-${quote.numero}.pdf`)
    } catch (e) {
      console.error('[QuoteView] PDF generation error:', e)
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
          padding: '2.5rem',
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

        {/* Numbered sections / articles */}
        <div style={{ borderTop: '1px solid #ddd', margin: '0 0 1.5rem' }} />
        {blocks.map((block, i) => <DocBlockView key={i} block={block} />)}

        {/* Acceptance */}
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#888', marginBottom: 8 }}>
          {isContract ? 'ARTICLE 19 — SIGNATURE' : '14. ACCEPTATION DU DEVIS'}
        </p>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '2.5rem' }}>
          {isContract ? 'Commande confirmée — Date et signature du client :' : 'Bon pour accord — Date et signature du client :'}
        </p>

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
