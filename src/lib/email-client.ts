// Client-facing emails of the quote → contract → delivery → invoice flow, in
// the language the client used on the site (quote.locale; French by default).
// Links point at the same language version of the site. The internal
// notifications to the admin stay in French, in email-templates.ts.
import { DEFAULT_BUSINESS, vatLabel } from '@/lib/business'
import { base, badge, heading, intro, infoBox, ctaButton, secondaryLink, esc, SITE_URL } from '@/lib/email-templates'

export type MailLocale = 'fr' | 'en'
export const mailLocale = (l?: string): MailLocale => (l === 'en' ? 'en' : 'fr')

type VatTerms = { vatEnabled: boolean; vatRate: number }
const pick = <T,>(l: MailLocale, fr: T, en: T): T => (l === 'en' ? en : fr)
const money = (n: number, l: MailLocale) => `${n.toLocaleString(l === 'en' ? 'en-GB' : 'fr-FR')} FCFA`
const day = (iso: string, l: MailLocale) =>
  new Date(iso).toLocaleDateString(l === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' })
const isAvenant = (kind?: string) => kind === 'avenant'
const strong = (s: string) => `<strong style="color:#26262E">${s}</strong>`
const smallLabel = (s: string) => `<p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">${s}</p>`
const codeBox = (l: MailLocale, code: string, note?: string) => infoBox(`
  ${smallLabel(pick(l, 'Code de suivi', 'Tracking code'))}
  <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#131318;letter-spacing:0.12em;font-family:'Courier New',Courier,monospace">${esc(code)}</p>
  ${note ? `<p style="margin:0;font-size:12px;color:#9A9AA6;line-height:1.6">${note}</p>` : ''}
`)

// ── Quote / avenant copy ─────────────────────────────────────────────────────

export function quoteClientCopyEmail(data: {
  numero: string
  accessCode: string
  signToken: string
  clientNom: string
  clientSociete?: string
  descriptionProjet: string
  items: { designation: string; quantite: number; prixUnitaireHT: number }[]
  totalHT: number
  tva: number
  totalTTC: number
  validiteJours: number
  terms?: VatTerms & { provider: { name: string } }
  kind?: string
  locale?: string
}, adminEmail: string) {
  const l = mailLocale(data.locale)
  const av = isAvenant(data.kind)
  const noun = pick(l, av ? 'avenant' : 'devis', av ? 'amendment' : 'quote')
  const Noun = pick(l, av ? 'Avenant' : 'Devis', av ? 'Amendment' : 'Quote')
  const safeNom = esc(data.clientNom)
  const firstName = safeNom.split(' ')[0]
  const safeSociete = data.clientSociete ? esc(data.clientSociete) : undefined
  const vat = vatLabel(data.terms ?? DEFAULT_BUSINESS).replace('TVA', pick(l, 'TVA', 'VAT'))

  const cell = 'padding:9px 0;border-bottom:1px solid #ECECF1;font-size:13px'
  const rows = data.items.map((it) => `
    <tr>
      <td style="${cell};color:#26262E">${esc(it.designation)}</td>
      <td style="${cell};color:#9A9AA6;text-align:center">${it.quantite}</td>
      <td style="${cell};color:#9A9AA6;text-align:right">${money(it.prixUnitaireHT, l)}</td>
    </tr>`).join('')
  const head = 'padding:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.08em;text-transform:uppercase'

  return {
    subject: pick(l, `Votre ${noun} ${data.numero} — ${data.terms?.provider.name ?? 'Nawaf Nemrod SALAMI'}`, `Your ${noun} ${data.numero} — ${data.terms?.provider.name ?? 'Nawaf Nemrod SALAMI'}`),
    html: base(
      pick(l, `Votre ${noun}`, `Your ${noun}`),
      pick(l, `Votre ${noun} ${data.numero} est prêt — ${money(data.totalTTC, l)} TTC`, `Your ${noun} ${data.numero} is ready — ${money(data.totalTTC, l)} incl. tax`),
      `
      ${badge(`${Noun} ${esc(data.numero)}`)}
      ${heading(pick(l, `Votre ${noun} est prêt, ${firstName}&nbsp;!`, `Your ${noun} is ready, ${firstName}!`))}
      ${intro(
        av
          ? pick(l, `Voici l’avenant correspondant à votre demande de prestations complémentaires, valable ${strong(`${data.validiteJours} jours`)}.`, `Here is the amendment for your request for additional services, valid for ${strong(`${data.validiteJours} days`)}.`)
          : pick(
              l,
              `Merci pour les détails de votre projet${safeSociete ? ` chez ${strong(safeSociete)}` : ''}. Voici le devis correspondant, valable ${strong(`${data.validiteJours} jours`)}.`,
              `Thank you for the details of your project${safeSociete ? ` at ${strong(safeSociete)}` : ''}. Here is the matching quote, valid for ${strong(`${data.validiteJours} days`)}.`,
            ),
      )}

      ${infoBox(`
        ${smallLabel(pick(l, 'Code de suivi', 'Tracking code'))}
        <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#131318;letter-spacing:0.12em;font-family:'Courier New',Courier,monospace">${esc(data.accessCode)}</p>
        <p style="margin:0;font-size:12px;color:#9A9AA6;line-height:1.6">${pick(l, 'Conservez ce code : il vous permet de suivre l’avancement de votre projet et de retrouver vos documents à tout moment.', 'Keep this code: it lets you follow your project and find your documents at any time.')}</p>
      `)}

      ${infoBox(`
        ${smallLabel(pick(l, 'Votre projet', 'Your project'))}
        <p style="margin:0;font-size:14px;color:#3A3A44;line-height:1.8;white-space:pre-wrap">${esc(data.descriptionProjet)}</p>
      `)}

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="text-align:left;margin-bottom:24px">
        <tr>
          <td style="${head}">${pick(l, 'Désignation', 'Description')}</td>
          <td style="${head};text-align:center">${pick(l, 'Qté', 'Qty')}</td>
          <td style="${head};text-align:right">${pick(l, 'Prix unit. HT', 'Unit price excl. tax')}</td>
        </tr>
        ${rows}
        <tr>
          <td colspan="2" style="padding:12px 0 0;font-size:13px;color:#9A9AA6">${pick(l, 'Total HT', 'Total excl. tax')}</td>
          <td style="padding:12px 0 0;font-size:13px;color:#26262E;text-align:right;font-weight:600">${money(data.totalHT, l)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:6px 0;font-size:13px;color:#9A9AA6">${vat}</td>
          <td style="padding:6px 0;font-size:13px;color:#26262E;text-align:right;font-weight:600">${money(data.tva, l)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:12px 14px;font-size:14px;font-weight:800;color:#FFFFFF;background:#131318">${pick(l, 'Total TTC', 'Total incl. tax')}</td>
          <td style="padding:12px 14px;font-size:14px;font-weight:800;color:#FFFFFF;text-align:right;background:#131318">${money(data.totalTTC, l)}</td>
        </tr>
      </table>

      ${ctaButton(`${SITE_URL}/${l}/devis/signature/${data.signToken}`, pick(l, `Consulter et signer mon ${noun}`, `Review and sign my ${noun}`))}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `Question sur le ${noun} ${data.numero}`, `Question about ${noun} ${data.numero}`))}`, pick(l, `Une question sur ce ${noun} ?`, 'A question?'))}
    `,
      l,
    ),
  }
}

// ── Signed (client) ──────────────────────────────────────────────────────────

export function quoteSignedClientEmail(data: {
  numero: string
  accessCode: string
  clientNom: string
  totalTTC: number
  kind?: string
  locale?: string
}, adminEmail: string) {
  const l = mailLocale(data.locale)
  const av = isAvenant(data.kind)
  const noun = pick(l, av ? 'avenant' : 'devis', av ? 'amendment' : 'quote')
  const Noun = pick(l, av ? 'Avenant' : 'Devis', av ? 'Amendment' : 'Quote')
  const firstName = esc(data.clientNom).split(' ')[0]

  return {
    subject: pick(l, `Votre ${noun} ${data.numero} a bien été signé`, `Your ${noun} ${data.numero} has been signed`),
    html: base(
      pick(l, `${Noun} signé`, `${Noun} signed`),
      pick(l, `Votre signature du ${noun} ${data.numero} a bien été enregistrée`, `Your signature of ${noun} ${data.numero} has been recorded`),
      `
      ${badge(`${Noun} ${esc(data.numero)}`)}
      ${heading(pick(l, `C’est signé, ${firstName}&nbsp;!`, `It’s signed, ${firstName}!`))}
      ${intro(pick(
        l,
        `Votre signature électronique a été enregistrée avec succès. Ce ${noun} vaut désormais confirmation de commande pour un montant de ${strong(money(data.totalTTC, l))} TTC. Le contrat signé est joint à cet e-mail au format PDF.`,
        `Your electronic signature has been recorded. This ${noun} now confirms your order for a total of ${strong(money(data.totalTTC, l))} incl. tax. The signed contract is attached to this email as a PDF.`,
      ))}

      ${codeBox(l, data.accessCode)}

      ${ctaButton(`${SITE_URL}/${l}/devis?ref=${encodeURIComponent(data.accessCode)}`, pick(l, 'Voir le document signé', 'View the signed document'))}
      ${secondaryLink(`${SITE_URL}/${l}/suivi?ref=${encodeURIComponent(data.accessCode)}`, pick(l, 'Suivre l’avancement du projet', 'Track the progress of the project'))}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `À propos du ${noun} ${data.numero}`, `About ${noun} ${data.numero}`))}`, pick(l, 'Une question ?', 'A question?'))}
    `,
      l,
    ),
  }
}

// ── Accepted by the admin (client) ───────────────────────────────────────────

export function quoteAcceptedEmail(data: {
  numero: string
  accessCode: string
  clientNom: string
  totalTTC: number
  locale?: string
}, adminEmail: string) {
  const l = mailLocale(data.locale)
  const firstName = esc(data.clientNom).split(' ')[0]

  return {
    subject: pick(l, `Devis accepté — contrat ${data.numero}`, `Quote accepted — contract ${data.numero}`),
    html: base(
      pick(l, 'Devis accepté', 'Quote accepted'),
      pick(l, `Votre devis ${data.numero} a été accepté — voici votre contrat`, `Your quote ${data.numero} has been accepted — here is your contract`),
      `
      ${badge(`${pick(l, 'Devis', 'Quote')} ${esc(data.numero)}`)}
      ${heading(pick(l, `C’est parti, ${firstName}&nbsp;!`, `Let’s go, ${firstName}!`))}
      ${intro(pick(l, 'Votre devis a été accepté et vaut désormais confirmation de commande. Retrouvez le contrat correspondant à tout moment avec votre code de suivi.', 'Your quote has been accepted and now confirms your order. You can find the matching contract at any time with your tracking code.'))}

      ${codeBox(l, data.accessCode, `${pick(l, 'Montant total accepté', 'Total amount accepted')} : ${strong(money(data.totalTTC, l))} ${pick(l, 'TTC', 'incl. tax')}.`)}

      ${ctaButton(`${SITE_URL}/${l}/devis?ref=${encodeURIComponent(data.accessCode)}`, pick(l, 'Voir mon contrat', 'View my contract'))}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `À propos du devis ${data.numero}`, `About quote ${data.numero}`))}`, pick(l, 'Une question ?', 'A question?'))}
    `,
      l,
    ),
  }
}

// ── Delivery → procès-verbal de recette ──────────────────────────────────────

export function deliveryEmail(data: {
  numero: string
  deliveryToken: string
  clientNom: string
  kind?: string
  locale?: string
  delivery?: { deliveredAt: string; note?: string; liveUrl?: string }
}, adminEmail: string) {
  const l = mailLocale(data.locale)
  const Noun = pick(l, isAvenant(data.kind) ? 'Avenant' : 'Devis', isAvenant(data.kind) ? 'Amendment' : 'Quote')
  const firstName = esc(data.clientNom).split(' ')[0]
  const liveUrl = data.delivery?.liveUrl ? esc(data.delivery.liveUrl) : undefined
  const note = data.delivery?.note ? esc(data.delivery.note) : undefined

  return {
    subject: pick(l, `Votre projet est livré — procès-verbal de recette ${data.numero}`, `Your project is delivered — acceptance report ${data.numero}`),
    html: base(
      pick(l, 'Projet livré', 'Project delivered'),
      pick(l, 'Votre projet est livré : merci de signer le procès-verbal de recette', 'Your project is delivered: please sign the acceptance report'),
      `
      ${badge(`${Noun} ${esc(data.numero)}`)}
      ${heading(pick(l, `Votre projet est livré, ${firstName}&nbsp;!`, `Your project is delivered, ${firstName}!`))}
      ${intro(pick(
        l,
        `Les prestations prévues sont livrées. Merci de les vérifier puis de signer le procès-verbal de recette (joint en PDF), avec ou sans réserves, depuis le lien ci-dessous. À défaut de retour sous ${strong('7 jours ouvrés')}, la livraison est réputée acceptée.`,
        `The agreed services are delivered. Please check them, then sign the acceptance report (attached as a PDF), with or without reservations, from the link below. With no answer within ${strong('7 working days')}, delivery is deemed accepted.`,
      ))}

      ${liveUrl || note ? infoBox(`
        ${liveUrl ? `${smallLabel(pick(l, 'Accès', 'Access'))}<p style="margin:0 0 ${note ? '14px' : '0'};font-size:14px"><a href="${liveUrl}" style="color:#131318;font-weight:600">${liveUrl}</a></p>` : ''}
        ${note ? `${smallLabel(pick(l, 'Remarques', 'Notes'))}<p style="margin:0;font-size:14px;color:#3A3A44;line-height:1.7;white-space:pre-wrap">${note}</p>` : ''}
      `) : ''}

      ${ctaButton(`${SITE_URL}/${l}/recette/${data.deliveryToken}`, pick(l, 'Consulter et signer le procès-verbal de recette', 'Review and sign the acceptance report'))}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `Livraison ${data.numero}`, `Delivery ${data.numero}`))}`, pick(l, 'Signaler un problème', 'Report a problem'))}
    `,
      l,
    ),
  }
}

// ── Recette signed (client) ──────────────────────────────────────────────────

export function acceptanceSignedClientEmail(data: {
  numero: string
  deliveryToken: string
  accessCode: string
  clientNom: string
  kind?: string
  locale?: string
  acceptance?: { reserves?: string }
}, adminEmail: string) {
  const l = mailLocale(data.locale)
  const Noun = pick(l, isAvenant(data.kind) ? 'Avenant' : 'Devis', isAvenant(data.kind) ? 'Amendment' : 'Quote')
  const firstName = esc(data.clientNom).split(' ')[0]
  const withReserves = !!data.acceptance?.reserves

  return {
    subject: pick(
      l,
      `Recette ${withReserves ? 'avec réserves ' : ''}enregistrée — ${data.numero}`,
      `Acceptance ${withReserves ? 'with reservations ' : ''}recorded — ${data.numero}`,
    ),
    html: base(
      pick(l, 'Recette enregistrée', 'Acceptance recorded'),
      pick(l, `Votre procès-verbal de recette ${data.numero} a bien été enregistré`, `Your acceptance report ${data.numero} has been recorded`),
      `
      ${badge(`${Noun} ${esc(data.numero)}`)}
      ${heading(pick(l, `Merci, ${firstName}&nbsp;!`, `Thank you, ${firstName}!`))}
      ${intro(
        withReserves
          ? pick(l, `Votre procès-verbal de recette a été enregistré ${strong('avec réserves')}. Elles seront traitées dans le cadre de la garantie. Le procès-verbal signé est joint à cet e-mail.`, `Your acceptance report has been recorded ${strong('with reservations')}. They will be handled under the warranty. The signed report is attached to this email.`)
          : pick(l, `Votre procès-verbal de recette a été enregistré ${strong('sans réserve')}. Le procès-verbal signé est joint à cet e-mail. La facture de solde vous sera adressée s’il y a lieu.`, `Your acceptance report has been recorded ${strong('without reservations')}. The signed report is attached to this email. The balance invoice will follow if applicable.`),
      )}

      ${ctaButton(`${SITE_URL}/${l}/recette/${data.deliveryToken}`, pick(l, 'Voir le procès-verbal signé', 'View the signed report'))}
      ${secondaryLink(`${SITE_URL}/${l}/suivi?ref=${encodeURIComponent(data.accessCode)}`, pick(l, 'Suivre l’avancement du projet', 'Track the progress of the project'))}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `À propos de la recette ${data.numero}`, `About the acceptance ${data.numero}`))}`, pick(l, 'Une question ?', 'A question?'))}
    `,
      l,
    ),
  }
}

// ── Invoice + receipt ────────────────────────────────────────────────────────

export interface InvoiceMailData {
  numero: string
  quoteNumero: string
  kind: 'acompte' | 'solde'
  dueAt: string
  netToPay: number
  locale?: string
  client: { nom: string }
  terms: { paymentMethods: string; paymentDetails: string }
  payment?: { paidAt: string; method: string; receiptNumero: string }
}

export function invoiceEmail(data: InvoiceMailData, adminEmail: string) {
  const l = mailLocale(data.locale)
  const firstName = esc(data.client.nom).split(' ')[0]
  const deposit = data.kind === 'acompte'
  const label = pick(l, deposit ? 'd’acompte' : 'de solde', deposit ? 'deposit' : 'balance')
  const due = deposit
    ? pick(l, 'Dès réception (le développement débute après le paiement)', 'On receipt (development starts once it is paid)')
    : esc(day(data.dueAt, l))

  return {
    subject: pick(l, `Facture ${deposit ? 'd’acompte' : 'de solde'} ${data.numero} — ${money(data.netToPay, l)}`, `${deposit ? 'Deposit' : 'Balance'} invoice ${data.numero} — ${money(data.netToPay, l)}`),
    html: base(
      pick(l, 'Votre facture', 'Your invoice'),
      pick(
        l,
        `Facture ${data.numero} — ${money(data.netToPay, l)} ${deposit ? 'à régler dès réception' : `à régler avant le ${day(data.dueAt, l)}`}`,
        `Invoice ${data.numero} — ${money(data.netToPay, l)} ${deposit ? 'payable on receipt' : `payable before ${day(data.dueAt, l)}`}`,
      ),
      `
      ${badge(`${pick(l, 'Facture', 'Invoice')} ${esc(data.numero)}`)}
      ${heading(pick(l, `Votre facture ${label}`, `Your ${label} invoice`))}
      ${intro(pick(
        l,
        `Bonjour ${firstName}, vous trouverez ci-joint la facture ${label} relative au devis ${strong(esc(data.quoteNumero))}.`,
        `Hello ${firstName}, please find attached the ${label} invoice for quote ${strong(esc(data.quoteNumero))}.`,
      ))}

      ${infoBox(`
        ${smallLabel(pick(l, 'Montant à régler', 'Amount to pay'))}
        <p style="margin:0 0 14px;font-size:22px;font-weight:800;color:#131318">${money(data.netToPay, l)}</p>
        ${smallLabel(pick(l, 'Échéance', 'Due'))}
        <p style="margin:0 0 14px;font-size:14px;color:#26262E">${due}</p>
        ${smallLabel(pick(l, 'Moyens de paiement', 'Payment methods'))}
        <p style="margin:0;font-size:13.5px;color:#26262E;line-height:1.6;white-space:pre-wrap">${esc(data.terms.paymentMethods)}${data.terms.paymentDetails ? `\n${esc(data.terms.paymentDetails)}` : ''}</p>
      `)}

      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `Facture ${data.numero}`, `Invoice ${data.numero}`))}`, pick(l, 'Une question sur cette facture ?', 'A question about this invoice?'))}
    `,
      l,
    ),
  }
}

export function receiptEmail(data: InvoiceMailData, adminEmail: string) {
  const l = mailLocale(data.locale)
  const firstName = esc(data.client.nom).split(' ')[0]
  const receipt = data.payment?.receiptNumero ?? ''

  return {
    subject: pick(l, `Reçu de paiement ${receipt} — ${money(data.netToPay, l)}`, `Payment receipt ${receipt} — ${money(data.netToPay, l)}`),
    html: base(
      pick(l, 'Paiement reçu', 'Payment received'),
      pick(l, `Nous avons bien reçu votre paiement de ${money(data.netToPay, l)}`, `We have received your payment of ${money(data.netToPay, l)}`),
      `
      ${badge(`${pick(l, 'Reçu', 'Receipt')} ${esc(receipt)}`)}
      ${heading(pick(l, `Paiement reçu, merci ${firstName}&nbsp;!`, `Payment received, thank you ${firstName}!`))}
      ${intro(pick(
        l,
        `Nous avons bien reçu votre règlement de ${strong(money(data.netToPay, l))}${data.payment ? ` le ${esc(day(data.payment.paidAt, l))} (${esc(data.payment.method)})` : ''}, pour la facture ${strong(esc(data.numero))}. Le reçu est joint à cet e-mail.`,
        `We have received your payment of ${strong(money(data.netToPay, l))}${data.payment ? ` on ${esc(day(data.payment.paidAt, l))} (${esc(data.payment.method)})` : ''}, for invoice ${strong(esc(data.numero))}. The receipt is attached to this email.`,
      ))}

      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `Reçu ${receipt}`, `Receipt ${receipt}`))}`, pick(l, 'Une question ?', 'A question?'))}
    `,
      l,
    ),
  }
}

// ── Testimonial request ──────────────────────────────────────────────────────

export function testimonialRequestEmail(data: { clientNom: string; numero: string; locale?: string }, adminEmail: string) {
  const l = mailLocale(data.locale)
  const firstName = esc(data.clientNom).split(' ')[0]

  return {
    subject: pick(l, `${firstName}, un avis sur notre collaboration ?`, `${firstName}, a review of our collaboration?`),
    html: base(
      pick(l, 'Votre avis compte', 'Your opinion matters'),
      pick(l, 'Un petit mot sur votre expérience avec Nawaf Nemrod SALAMI ?', 'A few words about your experience with Nawaf Nemrod SALAMI?'),
      `
      ${badge(`${pick(l, 'Devis', 'Quote')} ${esc(data.numero)}`)}
      ${heading(pick(l, `Un avis, ${firstName}&nbsp;?`, `A review, ${firstName}?`))}
      ${intro(pick(
        l,
        'J’espère que notre collaboration s’est bien passée ! Si vous avez deux minutes, un retour honnête m’aiderait énormément à faire connaître mon travail auprès d’autres clients.',
        'I hope our collaboration went well! If you have two minutes, an honest review would help me a great deal in making my work known to other clients.',
      ))}

      ${ctaButton(`${SITE_URL}/${l}/temoignage`, pick(l, 'Laisser un avis', 'Leave a review'))}
      ${secondaryLink(`mailto:${adminEmail}`, pick(l, 'Répondre directement', 'Reply directly'))}
    `,
      l,
    ),
  }
}

// ── Signature code ───────────────────────────────────────────────────────────

export function signatureCodeEmail(data: { numero: string; code: string; clientNom?: string; kind?: string; locale?: string }) {
  const l = mailLocale(data.locale)
  const noun = pick(l, isAvenant(data.kind) ? 'avenant' : 'devis', isAvenant(data.kind) ? 'amendment' : 'quote')
  const firstName = data.clientNom ? esc(data.clientNom).split(' ')[0] : ''

  return {
    subject: pick(l, `[${data.code}] Votre code de signature — ${noun} ${data.numero}`, `[${data.code}] Your signing code — ${noun} ${data.numero}`),
    html: base(
      pick(l, 'Code de signature', 'Signing code'),
      pick(l, `Votre code de signature est ${data.code} — valable 10 minutes`, `Your signing code is ${data.code} — valid for 10 minutes`),
      `
      ${badge(pick(l, 'Signature électronique', 'Electronic signature'))}
      ${heading(pick(l, `Votre code de signature${firstName ? `, ${firstName}` : ''}`, `Your signing code${firstName ? `, ${firstName}` : ''}`))}
      ${intro(pick(
        l,
        `Saisissez ce code sur la page de signature pour confirmer que vous êtes bien à l’origine de la signature du ${noun} ${strong(esc(data.numero))}. Il est valable ${strong('10 minutes')}.`,
        `Enter this code on the signing page to confirm that you are the one signing ${noun} ${strong(esc(data.numero))}. It is valid for ${strong('10 minutes')}.`,
      ))}

      ${infoBox(`
        <p style="margin:0;text-align:center;font-size:32px;font-weight:800;color:#131318;letter-spacing:0.3em;font-family:'Courier New',Courier,monospace">${esc(data.code)}</p>
      `)}

      <p style="margin:0;font-size:12px;color:#9A9AA6;line-height:1.6">${pick(l, 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : personne ne peut signer sans ce code.', 'If you did not request this, ignore this email: nobody can sign without this code.')}</p>
    `,
      l,
    ),
  }
}

// ── Automatic reminders ──────────────────────────────────────────────────────

export function quoteExpiringEmail(data: { numero: string; signToken: string; clientNom: string; kind?: string; locale?: string; expiresAt: string; daysLeft: number }, adminEmail: string) {
  const l = mailLocale(data.locale)
  const noun = pick(l, isAvenant(data.kind) ? 'avenant' : 'devis', isAvenant(data.kind) ? 'amendment' : 'quote')
  const firstName = esc(data.clientNom).split(' ')[0]
  const left = pick(l, `${data.daysLeft} jour${data.daysLeft > 1 ? 's' : ''}`, `${data.daysLeft} day${data.daysLeft > 1 ? 's' : ''}`)

  return {
    subject: pick(l, `Votre ${noun} ${data.numero} expire dans ${left}`, `Your ${noun} ${data.numero} expires in ${left}`),
    html: base(
      pick(l, 'Rappel', 'Reminder'),
      pick(l, `Votre ${noun} est valable jusqu’au ${day(data.expiresAt, l)}`, `Your ${noun} is valid until ${day(data.expiresAt, l)}`),
      `
      ${badge(`${pick(l, isAvenant(data.kind) ? 'Avenant' : 'Devis', isAvenant(data.kind) ? 'Amendment' : 'Quote')} ${esc(data.numero)}`)}
      ${heading(pick(l, `Votre ${noun} arrive à échéance`, `Your ${noun} is about to expire`))}
      ${intro(pick(
        l,
        `Bonjour ${firstName}, votre ${noun} ${strong(esc(data.numero))} reste valable jusqu’au ${strong(esc(day(data.expiresAt, l)))}. Passé ce délai, les prix et conditions pourront être révisés. Si le projet vous intéresse toujours, vous pouvez le signer en ligne en quelques minutes ; sinon, n’hésitez pas à me dire ce qui vous retient.`,
        `Hello ${firstName}, your ${noun} ${strong(esc(data.numero))} remains valid until ${strong(esc(day(data.expiresAt, l)))}. After that, prices and conditions may be revised. If the project still interests you, you can sign it online in a few minutes; otherwise, feel free to tell me what is holding you back.`,
      ))}

      ${ctaButton(`${SITE_URL}/${l}/devis/signature/${data.signToken}`, pick(l, `Consulter et signer le ${noun}`, `Review and sign the ${noun}`))}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(`${data.numero}`)}`, pick(l, 'Poser une question', 'Ask a question'))}
    `,
      l,
    ),
  }
}

export function invoiceOverdueEmail(data: InvoiceMailData & { reminderNumber: number; latePenaltyRate?: number }, adminEmail: string) {
  const l = mailLocale(data.locale)
  const firstName = esc(data.client.nom).split(' ')[0]
  const deposit = data.kind === 'acompte'
  const late = data.latePenaltyRate && data.latePenaltyRate > 0
    ? pick(
      l,
      ` Conformément aux conditions de vente, des pénalités de retard de ${data.latePenaltyRate} % par mois peuvent s’appliquer.`,
      ` As stated in the terms of sale, late-payment penalties of ${data.latePenaltyRate}% per month may apply.`,
    )
    : ''

  return {
    subject: pick(
      l,
      `${data.reminderNumber > 1 ? 'Nouveau rappel' : 'Rappel'} — facture ${data.numero} en attente de règlement`,
      `${data.reminderNumber > 1 ? 'Further reminder' : 'Reminder'} — invoice ${data.numero} awaiting payment`,
    ),
    html: base(
      pick(l, 'Rappel de paiement', 'Payment reminder'),
      pick(l, `Facture ${data.numero} — ${money(data.netToPay, l)} en attente`, `Invoice ${data.numero} — ${money(data.netToPay, l)} outstanding`),
      `
      ${badge(`${pick(l, 'Facture', 'Invoice')} ${esc(data.numero)}`)}
      ${heading(pick(l, 'Un petit rappel', 'A quick reminder'))}
      ${intro(pick(
        l,
        `Bonjour ${firstName}, sauf erreur de ma part, la facture ${deposit ? 'd’acompte' : 'de solde'} ${strong(esc(data.numero))} (échéance : ${esc(day(data.dueAt, l))}) n’a pas encore été réglée. Si le paiement est déjà parti, merci d’ignorer ce message et de m’en envoyer la référence.${late}`,
        `Hello ${firstName}, unless I am mistaken, the ${deposit ? 'deposit' : 'balance'} invoice ${strong(esc(data.numero))} (due ${esc(day(data.dueAt, l))}) has not been paid yet. If the payment is already on its way, please ignore this message and send me the reference.${late}`,
      ))}

      ${infoBox(`
        ${smallLabel(pick(l, 'Montant à régler', 'Amount to pay'))}
        <p style="margin:0 0 14px;font-size:22px;font-weight:800;color:#131318">${money(data.netToPay, l)}</p>
        ${smallLabel(pick(l, 'Moyens de paiement', 'Payment methods'))}
        <p style="margin:0;font-size:13.5px;color:#26262E;line-height:1.6;white-space:pre-wrap">${esc(data.terms.paymentMethods)}${data.terms.paymentDetails ? `\n${esc(data.terms.paymentDetails)}` : ''}</p>
      `)}

      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `Facture ${data.numero}`, `Invoice ${data.numero}`))}`, pick(l, 'Répondre à cet e-mail', 'Reply to this email'))}
    `,
      l,
    ),
  }
}

export function recetteReminderEmail(data: { numero: string; deliveryToken: string; clientNom: string; locale?: string; deemedAt: string }, adminEmail: string) {
  const l = mailLocale(data.locale)
  const firstName = esc(data.clientNom).split(' ')[0]

  return {
    subject: pick(l, `Rappel — procès-verbal de recette ${data.numero} à signer`, `Reminder — acceptance report ${data.numero} to sign`),
    html: base(
      pick(l, 'Rappel de recette', 'Acceptance reminder'),
      pick(l, `À défaut de retour avant le ${day(data.deemedAt, l)}, la livraison sera réputée acceptée`, `With no answer before ${day(data.deemedAt, l)}, delivery will be deemed accepted`),
      `
      ${badge(`${pick(l, 'Devis', 'Quote')} ${esc(data.numero)}`)}
      ${heading(pick(l, 'Votre recette est en attente', 'Your acceptance is pending'))}
      ${intro(pick(
        l,
        `Bonjour ${firstName}, le délai de recette de votre projet se termine le ${strong(esc(day(data.deemedAt, l)))}. Merci de signer le procès-verbal ou de me faire part de vos réserves avant cette date ; à défaut, la livraison sera réputée acceptée sans réserve, comme prévu au contrat.`,
        `Hello ${firstName}, the acceptance period for your project ends on ${strong(esc(day(data.deemedAt, l)))}. Please sign the report or send me your reservations before then; otherwise delivery will be deemed accepted without reservation, as stated in the contract.`,
      ))}

      ${ctaButton(`${SITE_URL}/${l}/recette/${data.deliveryToken}`, pick(l, 'Consulter et signer le procès-verbal', 'Review and sign the report'))}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `Recette ${data.numero}`, `Acceptance ${data.numero}`))}`, pick(l, 'Signaler un problème', 'Report a problem'))}
    `,
      l,
    ),
  }
}

export function recetteDeemedEmail(data: { numero: string; clientNom: string; locale?: string; warrantyDays: number; warrantyEnd: string }, adminEmail: string) {
  const l = mailLocale(data.locale)
  const firstName = esc(data.clientNom).split(' ')[0]

  return {
    subject: pick(l, `Livraison réputée acceptée — ${data.numero}`, `Delivery deemed accepted — ${data.numero}`),
    html: base(
      pick(l, 'Recette', 'Acceptance'),
      pick(l, 'Le délai de recette est écoulé : la livraison est réputée acceptée', 'The acceptance period is over: delivery is deemed accepted'),
      `
      ${badge(`${pick(l, 'Devis', 'Quote')} ${esc(data.numero)}`)}
      ${heading(pick(l, 'Livraison réputée acceptée', 'Delivery deemed accepted'))}
      ${intro(pick(
        l,
        `Bonjour ${firstName}, le délai de recette étant écoulé sans retour de votre part, la livraison est réputée acceptée sans réserve, conformément au contrat.${data.warrantyDays > 0 ? ` La garantie de correction des anomalies court jusqu’au ${strong(esc(day(data.warrantyEnd, l)))}.` : ''} Si un point vous a échappé, écrivez-moi : je regarde ça avec vous.`,
        `Hello ${firstName}, as the acceptance period has ended without a reply from you, delivery is deemed accepted without reservation, as stated in the contract.${data.warrantyDays > 0 ? ` The bug-fix warranty runs until ${strong(esc(day(data.warrantyEnd, l)))}.` : ''} If something slipped through, write to me and we will look at it together.`,
      ))}

      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(pick(l, `Livraison ${data.numero}`, `Delivery ${data.numero}`))}`, pick(l, 'Me contacter', 'Contact me'))}
    `,
      l,
    ),
  }
}
