'use client'

import { useState, useEffect, useRef } from 'react'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import ImageUpload from '@/components/admin/ImageUpload'
import FileUpload from '@/components/admin/FileUpload'
import SignatureSettings from '@/components/admin/SignatureSettings'
import { DEFAULT_BUSINESS, resolveBusiness } from '@/lib/business'
import type { BusinessSettings, PersonalInfo, SocialLinks } from '@/types'

export default function AdminPersonal() {
  const { data, updatePersonal, updateSocials } = usePortfolio()
  const toast = useToast()
  const [personal, setPersonal] = useState<PersonalInfo>(data.personal)
  const [socials, setSocials] = useState<SocialLinks>(data.socials)
  const [dirty, setDirty] = useState(false)

  // Sync local state once context finishes hydrating from localStorage/MongoDB
  const localOwned = useRef(false)
  useEffect(() => {
    if (!localOwned.current) { setPersonal(data.personal); setDirty(false) }
  }, [data.personal])
  useEffect(() => {
    if (!localOwned.current) { setSocials(data.socials); setDirty(false) }
  }, [data.socials])

  const handlePersonal = (patch: Partial<PersonalInfo>) => { localOwned.current = true; setPersonal((p) => ({ ...p, ...patch })); setDirty(true) }
  const business = personal.business ?? {}
  // What the documents will actually use (unset fields fall back to defaults).
  const effective = resolveBusiness(personal)
  const handleBusiness = (patch: Partial<BusinessSettings>) => handlePersonal({ business: { ...business, ...patch } })
  const numberOrUndefined = (raw: string) => (raw.trim() === '' || Number.isNaN(Number(raw)) ? undefined : Number(raw))
  const handleSocials = (key: string, val: string) => { localOwned.current = true; setSocials((p) => ({ ...p, [key]: val })); setDirty(true) }

  const handleSave = () => {
    updatePersonal(personal)
    updateSocials(socials)
    setDirty(false)
    toast('Profil sauvegardé')
  }

  const SOCIALS: [string, string, string][] = [
    ['LinkedIn', 'linkedin', 'https://linkedin.com/in/…'],
    ['GitHub', 'github', 'https://github.com/…'],
    ['Facebook', 'facebook', 'https://facebook.com/…'],
    ['Instagram', 'instagram', 'https://instagram.com/…'],
  ]

  return (
    <div className="space-y-6" style={{ maxWidth: '680px' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Profil & Réseaux</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Ces informations apparaissent sur toutes les pages du portfolio.
          </p>
        </div>
        {dirty && (
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(228,87,66,0.12)', color: '#E45742', border: '1px solid rgba(228,87,66,0.3)', fontFamily: 'var(--font-poppins)' }}>
            Modifications non sauvegardées
          </span>
        )}
      </div>

      {/* Photo */}
      <section className="card no-lift p-6">
        <p className="section-label mb-5">Photo de profil</p>
        <ImageUpload
          value={personal.photo}
          onChange={(v) => handlePersonal({ photo: v })}
          size="lg"
          shape="circle"
          placeholder="Photo de profil"
          label=""
        />
      </section>

      {/* CV */}
      <section className="card no-lift p-6">
        <p className="section-label mb-2">CV / Résumé</p>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Le chatbot du portfolio propose ce fichier aux visiteurs qui demandent votre CV. Uploader un nouveau fichier remplace l&apos;ancien.
        </p>
        <FileUpload
          value={personal.cvUrl}
          onChange={(v) => handlePersonal({ cvUrl: v })}
          accept="application/pdf"
          maxSizeMb={5}
          hint="PDF — max 5 Mo"
        />
      </section>

      {/* Infos */}
      <section className="card no-lift p-6">
        <p className="section-label mb-5">Informations personnelles</p>
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="pi-name">Nom complet</label>
            <input id="pi-name" className="input" value={personal.name} onChange={(e) => handlePersonal({ name: e.target.value })} placeholder="Prénom Nom" />
          </div>
          <div>
            <label className="field-label" htmlFor="pi-role">Titre / Métier</label>
            <input id="pi-role" className="input" value={personal.role} onChange={(e) => handlePersonal({ role: e.target.value })} placeholder="Développeur Fullstack & DevOps" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="pi-email">Email de contact</label>
              <input id="pi-email" className="input" type="email" value={personal.email} onChange={(e) => handlePersonal({ email: e.target.value })} placeholder="vous@email.com" />
            </div>
            <div>
              <label className="field-label" htmlFor="pi-location">Localisation</label>
              <input id="pi-location" className="input" value={personal.location} onChange={(e) => handlePersonal({ location: e.target.value })} placeholder="Ville, Gabon — Remote" />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="pi-whatsapp">Numéro WhatsApp</label>
            <input
              id="pi-whatsapp" className="input" type="tel"
              value={personal.whatsapp ?? ''}
              onChange={(e) => handlePersonal({ whatsapp: e.target.value })}
              placeholder="+241 77 00 00 00"
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
              Format international avec indicatif. Affiche un bouton WhatsApp sur le site si renseigné.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="pi-bio">Biographie</label>
            <textarea
              id="pi-bio"
              value={personal.bio}
              onChange={(e) => handlePersonal({ bio: e.target.value })}
              rows={4}
              placeholder="Quelques mots sur vous…"
              className="input"
              style={{ resize: 'vertical', minHeight: '100px' }}
            />
          </div>
        </div>
      </section>

      {/* Informations légales & conditions commerciales */}
      <section className="card no-lift p-6">
        <p className="section-label mb-2">Informations légales &amp; conditions commerciales</p>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Imprimées sur les devis, contrats, avenants, factures, reçus, mentions légales et CGV. Un champ vide est simplement omis des documents.
          Chaque devis mémorise ces valeurs au moment de son émission : les modifier n&apos;affecte pas les devis déjà émis.
        </p>

        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>Identité du prestataire</p>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="field-label" htmlFor="bz-status">Statut juridique</label>
            <input id="bz-status" className="input" value={business.legalStatus ?? ''} onChange={(e) => handleBusiness({ legalStatus: e.target.value })} placeholder="Entrepreneur individuel" />
          </div>
          <div>
            <label className="field-label" htmlFor="bz-rccm">N° d&apos;immatriculation (RCCM)</label>
            <input id="bz-rccm" className="input" value={business.registrationNumber ?? ''} onChange={(e) => handleBusiness({ registrationNumber: e.target.value })} placeholder="RG/LBV/20XX/A/XXXX" />
          </div>
          <div>
            <label className="field-label" htmlFor="bz-nif">N° d&apos;identification fiscale (NIF)</label>
            <input id="bz-nif" className="input" value={business.taxId ?? ''} onChange={(e) => handleBusiness({ taxId: e.target.value })} placeholder="NIF" />
          </div>
          <div>
            <label className="field-label" htmlFor="bz-address">Adresse complète</label>
            <input id="bz-address" className="input" value={business.address ?? ''} onChange={(e) => handleBusiness({ address: e.target.value })} placeholder="Quartier, rue, Libreville, Gabon" />
          </div>
        </div>

        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>TVA</p>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={effective.vatEnabled} onChange={(e) => handleBusiness({ vatEnabled: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
            Je facture la TVA
          </label>
          {effective.vatEnabled ? (
            <div>
              <label className="field-label" htmlFor="bz-vat">Taux de TVA (%)</label>
              <input id="bz-vat" className="input" type="number" min={0} max={100} step="0.1" value={business.vatRate ?? ''} onChange={(e) => handleBusiness({ vatRate: numberOrUndefined(e.target.value) })} placeholder={String(DEFAULT_BUSINESS.vatRate)} />
            </div>
          ) : (
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="bz-vat-mention">Mention imprimée à la place de la TVA</label>
              <input id="bz-vat-mention" className="input" value={business.vatExemptionMention ?? ''} onChange={(e) => handleBusiness({ vatExemptionMention: e.target.value })} placeholder={DEFAULT_BUSINESS.vatExemptionMention} />
            </div>
          )}
        </div>

        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>Paiement</p>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="field-label" htmlFor="bz-methods">Moyens de paiement acceptés</label>
            <input id="bz-methods" className="input" value={business.paymentMethods ?? ''} onChange={(e) => handleBusiness({ paymentMethods: e.target.value })} placeholder={DEFAULT_BUSINESS.paymentMethods} />
          </div>
          <div>
            <label className="field-label" htmlFor="bz-details">Coordonnées de paiement (sur les factures)</label>
            <input id="bz-details" className="input" value={business.paymentDetails ?? ''} onChange={(e) => handleBusiness({ paymentDetails: e.target.value })} placeholder="IBAN / n° Airtel Money / n° Moov Money" />
          </div>
          <div>
            <label className="field-label" htmlFor="bz-deposit">Acompte à la signature (%)</label>
            <input id="bz-deposit" className="input" type="number" min={0} max={100} value={business.depositPercent ?? ''} onChange={(e) => handleBusiness({ depositPercent: numberOrUndefined(e.target.value) })} placeholder={String(DEFAULT_BUSINESS.depositPercent)} />
          </div>
          <div>
            <label className="field-label" htmlFor="bz-due">Délai de paiement d&apos;une facture (jours)</label>
            <input id="bz-due" className="input" type="number" min={0} max={365} value={business.paymentDueDays ?? ''} onChange={(e) => handleBusiness({ paymentDueDays: numberOrUndefined(e.target.value) })} placeholder={String(DEFAULT_BUSINESS.paymentDueDays)} />
          </div>
          <div>
            <label className="field-label" htmlFor="bz-penalty">Pénalité de retard (% par mois)</label>
            <input id="bz-penalty" className="input" type="number" min={0} max={100} step="0.1" value={business.latePenaltyRate ?? ''} onChange={(e) => handleBusiness({ latePenaltyRate: numberOrUndefined(e.target.value) })} placeholder={String(DEFAULT_BUSINESS.latePenaltyRate)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={effective.depositRefundable} onChange={(e) => handleBusiness({ depositRefundable: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
            L&apos;acompte est remboursable en cas d&apos;annulation
          </label>
        </div>

        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>Exécution</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="bz-delivery">Délai de réalisation par défaut (jours ouvrés)</label>
            <input id="bz-delivery" className="input" type="number" min={1} max={730} value={business.deliveryDays ?? ''} onChange={(e) => handleBusiness({ deliveryDays: numberOrUndefined(e.target.value) })} placeholder={String(DEFAULT_BUSINESS.deliveryDays)} />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
              Valeur de départ de chaque devis. Elle se règle ensuite projet par projet dans l&apos;admin des devis, tant que le client n&apos;a pas signé.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="bz-revisions">Cycles de révision inclus</label>
            <input id="bz-revisions" className="input" type="number" min={0} max={50} value={business.includedRevisions ?? ''} onChange={(e) => handleBusiness({ includedRevisions: numberOrUndefined(e.target.value) })} placeholder={String(DEFAULT_BUSINESS.includedRevisions)} />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
              Un cycle = un lot groupé de demandes d&apos;ajustement (couleur, texte, position d&apos;une section…). Ajouter un vrai module ou une fonctionnalité n&apos;est pas une révision : c&apos;est facturé à part, par avenant.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="bz-warranty">Garantie après livraison (jours)</label>
            <input id="bz-warranty" className="input" type="number" min={0} max={730} value={business.warrantyDays ?? ''} onChange={(e) => handleBusiness({ warrantyDays: numberOrUndefined(e.target.value) })} placeholder={String(DEFAULT_BUSINESS.warrantyDays)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={effective.sourceCodeDelivery} onChange={(e) => handleBusiness({ sourceCodeDelivery: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
            Je remets le code source après paiement intégral
          </label>
        </div>
      </section>

      {/* Signature électronique */}
      <section className="card no-lift p-6">
        <p className="section-label mb-2">Signature électronique</p>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Utilisée automatiquement sur les devis et contrats signés électroniquement par vos clients.
        </p>
        <SignatureSettings value={personal.signatureUrl} onChange={(v) => handlePersonal({ signatureUrl: v })} />
      </section>

      {/* Réseaux */}
      <section className="card no-lift p-6">
        <p className="section-label mb-5">Réseaux sociaux</p>
        <div className="space-y-4">
          {SOCIALS.map(([label, key, ph]) => (
            <div key={key}>
              <label className="field-label" htmlFor={`social-${key}`}>{label}</label>
              <input
                id={`social-${key}`}
                className="input"
                value={socials[key] ?? ''}
                onChange={(e) => handleSocials(key, e.target.value)}
                placeholder={ph}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4 pb-2">
        <button onClick={handleSave} className="btn-primary btn-sm">
          Sauvegarder les modifications
        </button>
        {!dirty && (
          <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Tout est sauvegardé
          </span>
        )}
      </div>
    </div>
  )
}
