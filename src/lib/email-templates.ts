import { DEFAULT_BUSINESS, vatLabel } from '@/lib/business'

type VatTerms = { vatEnabled: boolean; vatRate: number }
const vatRowLabel = (t?: VatTerms) => vatLabel(t ?? DEFAULT_BUSINESS)
// An avenant travels through the same emails as a devis — only the noun changes.
const noun = (kind?: string) => (kind === 'avenant' ? 'avenant' : 'devis')
const Noun = (kind?: string) => (kind === 'avenant' ? 'Avenant' : 'Devis')

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ── SVG Icons — single ink color, no per-category colors ────────────────────

const INK = '#26262E'
const MUTED = '#9A9AA6'

const icon = {
  shield: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  user: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  mail: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  tag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.28-8.28a1 1 0 0 0 0-1.42Z"/><path d="M7 7h.01"/></svg>`,
  message: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${MUTED}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  alert: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  video: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>`,
}

const phone = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`

const star = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${INK}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`

function starRow(rating: number): string {
  const clamped = Math.min(5, Math.max(0, Math.round(rating)))
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="opacity:${i < clamped ? '1' : '0.25'}">${star}</span>`,
  ).join('')
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nawafsalami-itech.vercel.app'

// ── Base layout — light, centered, monochrome boutique-agency style ─────────

const base = (title: string, preheader: string, body: string) => {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${title}</title>
  <style>
    @media only screen and (max-width:600px){
      .wrapper{padding:32px 12px!important}
      .card{padding:36px 22px!important}
      .otp-box{width:36px!important;height:46px!important;font-size:20px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F2F2F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">

  <div style="display:none;max-height:0;overflow:hidden;color:#F2F2F6">${preheader}&nbsp;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td class="wrapper" style="padding:56px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;margin:0 auto">

          <tr>
            <td class="card" style="background:#FFFFFF;border:1px solid #E8E8EF;padding:48px 42px;text-align:center">

              <img src="${SITE_URL}/logo-black.png" width="52" height="52" alt="Nawaf Nemrod SALAMI" style="display:block;margin:0 auto 22px;width:52px;height:52px"/>

              ${body}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center">
              <p style="margin:0 0 6px;font-size:12px;color:#9A9AA6;letter-spacing:0.02em">
                &copy; ${year} Nawaf Nemrod SALAMI &nbsp;&middot;&nbsp; Libreville, Gabon
              </p>
              <p style="margin:0;font-size:11px;color:#C0C0CB">
                Cet e-mail est g&eacute;n&eacute;r&eacute; automatiquement &mdash; merci de ne pas y r&eacute;pondre directement.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Shared components — monochrome only ──────────────────────────────────────

const badge = (label: string) => `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 18px">
    <tr>
      <td style="background:#131318;color:#FFFFFF;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:7px 15px">
        ${label}
      </td>
    </tr>
  </table>`

const heading = (text: string) => `
  <p style="margin:0 0 12px;font-size:24px;font-weight:800;color:#131318;letter-spacing:-0.4px;line-height:1.25">${text}</p>`

const intro = (html: string) => `
  <p style="margin:0 0 28px;font-size:14.5px;color:#6B6B76;line-height:1.7">${html}</p>`

// Rounded light-gray box for structured, left-aligned content (data, message
// bodies, tables) — plain card, no accent stripe.
const infoBox = (contentHtml: string) => `
  <div style="background:#F9F9FB;border:1px solid #ECECF1;padding:22px 24px;text-align:left;margin-bottom:24px">
    ${contentHtml}
  </div>`

const ctaButton = (href: string, label: string) => `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 8px;width:100%">
    <tr>
      <td>
        <a href="${href}"
          style="display:block;text-align:center;background:#131318;color:#FFFFFF;font-size:14px;font-weight:700;letter-spacing:0.01em;padding:15px 24px;text-decoration:none">
          ${label}
        </a>
      </td>
    </tr>
  </table>`

const secondaryLink = (href: string, label: string) => `
  <p style="margin:14px 0 0;text-align:center">
    <a href="${href}" style="font-size:12.5px;color:#9A9AA6;text-decoration:underline">${label}</a>
  </p>`

const dataRow = (ico: string, label: string, value: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:12px">
    <tr>
      <td style="width:26px;vertical-align:top;padding-top:1px">${ico}</td>
      <td style="vertical-align:top">
        <p style="margin:0 0 1px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">${label}</p>
        <p style="margin:0;font-size:13.5px;color:#26262E;line-height:1.5">${value}</p>
      </td>
    </tr>
  </table>`

const divider = `<div style="height:1px;background:#ECECF1;margin:22px 0"></div>`

// ── OTP Login ──────────────────────────────────────────────────────────────

export function otpEmail(otp: string) {
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Libreville' })

  const boxes = otp.split('').map((d) => `
    <td style="padding:0 4px">
      <div class="otp-box" style="width:46px;height:58px;line-height:58px;background:#F9F9FB;border:1.5px solid #D8D8E0;text-align:center;font-size:26px;font-weight:700;font-family:'Courier New',Courier,monospace;color:#131318">
        ${d}
      </div>
    </td>`).join('')

  return {
    subject: `[${otp}] Code de connexion — Portfolio NS`,
    html: base('Code de connexion', `Votre code OTP est ${otp} — valable 60 secondes`, `
      ${badge('Authentification')}
      ${heading('Votre code de connexion')}
      ${intro('Une tentative de connexion a &eacute;t&eacute; d&eacute;tect&eacute;e sur votre panneau d&rsquo;administration. Saisissez ce code pour confirmer votre identit&eacute;.')}

      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 24px">
        <tr>${boxes}</tr>
      </table>

      ${infoBox(`
        ${dataRow(icon.clock, 'Expiration', '<strong>60 secondes</strong>')}
        ${dataRow(icon.clock, 'Horodatage', now)}
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:6px;padding-top:14px;border-top:1px solid #ECECF1">
          <tr>
            <td style="width:22px;vertical-align:top;padding-top:2px">${icon.alert}</td>
            <td>
              <p style="margin:0;font-size:12.5px;color:#6B6B76;line-height:1.6">
                Si vous n&rsquo;&ecirc;tes pas &agrave; l&rsquo;origine de cette demande, <strong style="color:#131318">ignorez cet e-mail</strong>. Personne d&rsquo;autre n&rsquo;a acc&egrave;s &agrave; votre compte.
              </p>
            </td>
          </tr>
        </table>
      `)}
    `),
  }
}

// ── Contact notification (admin) ───────────────────────────────────────────

const SUBJECT_LABELS: Record<string, string> = {
  mission: 'Mission / Projet freelance',
  collaboration: 'Collaboration',
  conseil: 'Conseil technique',
  autre: 'Autre',
}

export function contactNotificationEmail(data: {
  name: string; email: string; phone?: string; subject: string; customSubject?: string; message: string
}) {
  const rawLabel = data.subject === 'autre' && data.customSubject
    ? data.customSubject
    : (SUBJECT_LABELS[data.subject] ?? data.subject)
  const label = esc(rawLabel)
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' })
  const safeName    = esc(data.name)
  const safeEmail   = esc(data.email)
  const safePhone   = data.phone ? esc(data.phone) : undefined
  const safeMessage = esc(data.message)

  return {
    subject: `Nouveau message — ${rawLabel} — ${data.name}`,
    html: base('Nouveau message de contact', `${safeName} vous a envoyé un message via votre portfolio`, `
      ${badge('Formulaire de contact')}
      ${heading('Nouveau message re&ccedil;u')}
      ${intro(`<strong style="color:#26262E">${safeName}</strong> a utilis&eacute; votre formulaire de contact le ${now}.`)}

      ${infoBox(`
        ${dataRow(icon.user, 'Nom', `<strong>${safeName}</strong>`)}
        ${dataRow(icon.mail, 'Email', `<a href="mailto:${safeEmail}" style="color:#131318;text-decoration:underline;font-weight:600">${safeEmail}</a>`)}
        ${safePhone ? dataRow(phone, 'T&eacute;l&eacute;phone', `<a href="tel:${safePhone}" style="color:#131318;text-decoration:underline;font-weight:600">${safePhone}</a>`) : ''}
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:2px">
          <tr>
            <td style="width:26px;vertical-align:top;padding-top:1px">${icon.tag}</td>
            <td>
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Sujet</p>
              <span style="display:inline-block;background:#F4F4F7;border:1px solid #E3E3EA;color:#131318;font-size:11px;font-weight:700;padding:3px 10px;letter-spacing:0.04em">${label}</span>
            </td>
          </tr>
        </table>
      `)}

      ${infoBox(`
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Message</p>
        <p style="margin:0;font-size:14px;color:#3A3A44;line-height:1.8;white-space:pre-wrap">${safeMessage}</p>
      `)}

      ${ctaButton(`mailto:${safeEmail}?subject=Re%3A+${encodeURIComponent(rawLabel)}&body=Bonjour+${encodeURIComponent(data.name)}%2C%0A%0A`, `R&eacute;pondre &agrave; ${safeName}`)}
      ${secondaryLink(`mailto:${safeEmail}`, "Copier l'email")}
    `),
  }
}

// ── Testimonial submission (admin) — awaiting moderation ────────────────────

export function testimonialNotificationEmail(data: { name: string; role?: string; company?: string; text: string; rating: number }) {
  const safeName = esc(data.name)
  const roleCompany = [data.role, data.company].filter((v): v is string => !!v).map(esc).join(' — ')
  const safeText = esc(data.text)
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' })

  return {
    subject: `Nouveau témoignage à valider — ${data.name} (${data.rating}/5)`,
    html: base('Nouveau témoignage', `${safeName} a laissé un témoignage sur votre portfolio`, `
      ${badge('Témoignage · À valider')}
      ${heading('Un nouveau t&eacute;moignage attend votre validation')}
      ${intro(`<strong style="color:#26262E">${safeName}</strong> a laiss&eacute; un t&eacute;moignage le ${now}. Il n&rsquo;appara&icirc;tra sur le site qu&rsquo;apr&egrave;s votre approbation dans le tableau de bord.`)}

      ${infoBox(`
        ${dataRow(icon.user, 'Nom', `<strong>${safeName}</strong>${roleCompany ? ` &mdash; ${roleCompany}` : ''}`)}
        <div style="margin-top:10px">${starRow(data.rating)}<span style="margin-left:6px;font-size:12px;font-weight:700;color:#26262E;vertical-align:middle">${data.rating}/5</span></div>
        <p style="margin:12px 0 0;font-size:14px;color:#3A3A44;line-height:1.8;white-space:pre-wrap">&ldquo;${safeText}&rdquo;</p>
      `)}

      ${ctaButton(`${SITE_URL}/admin/testimonials`, 'Valider ce témoignage')}
    `),
  }
}

// ── Contact auto-reply (visitor) ───────────────────────────────────────────

export function contactAutoReplyEmail(data: {
  name: string; subject: string; customSubject?: string; message: string
}) {
  const rawLabel = data.subject === 'autre' && data.customSubject
    ? data.customSubject
    : (SUBJECT_LABELS[data.subject] ?? data.subject)
  const label = esc(rawLabel)
  const safeName = esc(data.name)
  const preview = esc(data.message.length > 140 ? data.message.slice(0, 140).trimEnd() + '…' : data.message)

  return {
    subject: `Votre message a bien été reçu — Nawaf Nemrod SALAMI`,
    html: base('Message reçu', `Merci ${safeName}, votre message a bien été reçu. Je vous répondrai sous 48h.`, `
      ${badge('Message re&ccedil;u')}
      ${heading(`Merci, ${safeName}&nbsp;!`)}
      ${intro(`Votre message a bien &eacute;t&eacute; re&ccedil;u et je m&rsquo;engage &agrave; vous r&eacute;pondre dans les <strong style="color:#26262E">48 heures ouvr&eacute;es</strong>. En attendant, n&rsquo;h&eacute;sitez pas &agrave; consulter mes projets sur le portfolio.`)}

      ${infoBox(`
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Sujet</p>
        <p style="margin:0 0 16px;font-size:13.5px;font-weight:600;color:#26262E">${label}</p>
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Votre message</p>
        <p style="margin:0;font-size:13.5px;color:#6B6B76;line-height:1.7;font-style:italic">&ldquo;${preview}&rdquo;</p>
      `)}

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="text-align:left;margin-bottom:8px">
        <tr>
          <td style="width:24px;vertical-align:top;padding-top:2px">
            <div style="width:20px;height:20px;background:#131318;text-align:center;line-height:20px">${icon.check}</div>
          </td>
          <td style="padding-bottom:14px">
            <p style="margin:0;font-size:13px;font-weight:600;color:#26262E">Message envoy&eacute;</p>
            <p style="margin:2px 0 0;font-size:12px;color:#9A9AA6">Votre demande est bien enregistr&eacute;e.</p>
          </td>
        </tr>
        <tr>
          <td style="width:24px;vertical-align:top;padding-top:2px">
            <div style="width:20px;height:20px;background:#F4F4F7;border:1.5px solid #DADAE2;text-align:center;line-height:18px">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#B0B0BB" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/></svg>
            </div>
          </td>
          <td>
            <p style="margin:0;font-size:13px;font-weight:600;color:#9A9AA6">R&eacute;ponse sous 48h ouvr&eacute;es</p>
            <p style="margin:2px 0 0;font-size:12px;color:#B0B0BB">Je reviendrai vers vous par e-mail.</p>
          </td>
        </tr>
      </table>

      ${divider}
      <p style="margin:0;font-size:13px;font-weight:700;color:#26262E">Nawaf Nemrod SALAMI</p>
      <p style="margin:2px 0 0;font-size:12px;color:#9A9AA6">D&eacute;veloppeur Web Fullstack &amp; DevOps &nbsp;&middot;&nbsp; Libreville, Gabon</p>
    `),
  }
}

// ── Quote notification (admin) ─────────────────────────────────────────────

export function quoteNotificationEmail(data: {
  numero: string
  clientNom: string
  clientSociete?: string
  clientEmail?: string
  clientTelephone?: string
  descriptionProjet: string
  items: { designation: string; quantite: number; prixUnitaireHT: number }[]
  totalHT: number
  tva: number
  totalTTC: number
  terms?: VatTerms
  kind?: string
}) {
  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' })
  const safeNom = esc(data.clientNom)
  const safeSociete = data.clientSociete ? esc(data.clientSociete) : undefined
  const safeEmail = data.clientEmail ? esc(data.clientEmail) : undefined
  const safePhone = data.clientTelephone ? esc(data.clientTelephone) : undefined
  const safeDescription = esc(data.descriptionProjet)

  const itemsRows = data.items.map((it) => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #ECECF1;font-size:13px;color:#26262E">${esc(it.designation)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #ECECF1;font-size:13px;color:#9A9AA6;text-align:center">${it.quantite}</td>
      <td style="padding:9px 0;border-bottom:1px solid #ECECF1;font-size:13px;color:#9A9AA6;text-align:right">${fmt(it.prixUnitaireHT)}</td>
    </tr>`).join('')

  return {
    subject: `Devis généré par le chatbot — ${data.numero} — ${data.clientNom}`,
    html: base('Nouveau devis généré', `Le chatbot a généré un devis pour ${safeNom}`, `
      ${badge(`Devis ${esc(data.numero)}`)}
      ${heading('Nouveau devis g&eacute;n&eacute;r&eacute; par le chatbot')}
      ${intro(`<strong style="color:#26262E">${safeNom}</strong>${safeSociete ? ` (${safeSociete})` : ''} a discut&eacute; avec l&rsquo;assistant le ${now} et un devis a &eacute;t&eacute; g&eacute;n&eacute;r&eacute; automatiquement.`)}

      ${infoBox(`
        ${dataRow(icon.user, 'Client', `<strong>${safeNom}</strong>${safeSociete ? ` &mdash; ${safeSociete}` : ''}`)}
        ${safeEmail ? dataRow(icon.mail, 'Email', `<a href="mailto:${safeEmail}" style="color:#131318;text-decoration:underline;font-weight:600">${safeEmail}</a>`) : ''}
        ${safePhone ? dataRow(phone, 'T&eacute;l&eacute;phone', `<a href="tel:${safePhone}" style="color:#131318;text-decoration:underline;font-weight:600">${safePhone}</a>`) : ''}
      `)}

      ${infoBox(`
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Description du projet</p>
        <p style="margin:0;font-size:14px;color:#3A3A44;line-height:1.8;white-space:pre-wrap">${safeDescription}</p>
      `)}

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="text-align:left;margin-bottom:24px">
        <tr>
          <td style="padding:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.08em;text-transform:uppercase">D&eacute;signation</td>
          <td style="padding:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.08em;text-transform:uppercase;text-align:center">Qt&eacute;</td>
          <td style="padding:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.08em;text-transform:uppercase;text-align:right">Prix unit. HT</td>
        </tr>
        ${itemsRows}
        <tr>
          <td colspan="2" style="padding:12px 0 0;font-size:13px;color:#9A9AA6">Total HT</td>
          <td style="padding:12px 0 0;font-size:13px;color:#26262E;text-align:right;font-weight:600">${fmt(data.totalHT)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:6px 0;font-size:13px;color:#9A9AA6">${vatRowLabel(data.terms)}</td>
          <td style="padding:6px 0;font-size:13px;color:#26262E;text-align:right;font-weight:600">${fmt(data.tva)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:12px 14px;font-size:14px;font-weight:800;color:#FFFFFF;background:#131318">Total TTC</td>
          <td style="padding:12px 14px;font-size:14px;font-weight:800;color:#FFFFFF;text-align:right;background:#131318">${fmt(data.totalTTC)}</td>
        </tr>
      </table>

      ${safeEmail ? ctaButton(`mailto:${safeEmail}?subject=${encodeURIComponent(`Suite à votre devis ${data.numero}`)}`, `Contacter ${safeNom}`) : ''}
    `),
  }
}

// ── Quote copy (client) ────────────────────────────────────────────────────

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
}, adminEmail: string) {
  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
  const safeNom = esc(data.clientNom)
  const safeSociete = data.clientSociete ? esc(data.clientSociete) : undefined

  const itemsRows = data.items.map((it) => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #ECECF1;font-size:13px;color:#26262E">${esc(it.designation)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #ECECF1;font-size:13px;color:#9A9AA6;text-align:center">${it.quantite}</td>
      <td style="padding:9px 0;border-bottom:1px solid #ECECF1;font-size:13px;color:#9A9AA6;text-align:right">${fmt(it.prixUnitaireHT)}</td>
    </tr>`).join('')

  return {
    subject: `Votre ${noun(data.kind)} ${data.numero} — ${data.terms?.provider.name ?? 'Nawaf Nemrod SALAMI'}`,
    html: base(`Votre ${noun(data.kind)}`, `Votre ${noun(data.kind)} ${data.numero} est pr&ecirc;t — ${fmt(data.totalTTC)} TTC`, `
      ${badge(`${Noun(data.kind)} ${esc(data.numero)}`)}
      ${heading(`Votre ${noun(data.kind)} est pr&ecirc;t, ${safeNom.split(' ')[0]}&nbsp;!`)}
      ${intro(`${data.kind === 'avenant' ? 'Voici l&rsquo;avenant correspondant &agrave; votre demande de prestations compl&eacute;mentaires' : `Merci pour les d&eacute;tails de votre projet${safeSociete ? ` chez <strong style="color:#26262E">${safeSociete}</strong>` : ''}. Voici le devis correspondant`}, valable <strong style="color:#26262E">${data.validiteJours} jours</strong>.`)}

      ${infoBox(`
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Code de suivi</p>
        <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#131318;letter-spacing:0.12em;font-family:'Courier New',Courier,monospace">${esc(data.accessCode)}</p>
        <p style="margin:0;font-size:12px;color:#9A9AA6;line-height:1.6">Conservez ce code : donnez-le au chatbot du portfolio pour retrouver ce devis &agrave; tout moment, sans tout redemander.</p>
      `)}

      ${infoBox(`
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Votre projet</p>
        <p style="margin:0;font-size:14px;color:#3A3A44;line-height:1.8;white-space:pre-wrap">${esc(data.descriptionProjet)}</p>
      `)}

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="text-align:left;margin-bottom:24px">
        <tr>
          <td style="padding:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.08em;text-transform:uppercase">D&eacute;signation</td>
          <td style="padding:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.08em;text-transform:uppercase;text-align:center">Qt&eacute;</td>
          <td style="padding:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.08em;text-transform:uppercase;text-align:right">Prix unit. HT</td>
        </tr>
        ${itemsRows}
        <tr>
          <td colspan="2" style="padding:12px 0 0;font-size:13px;color:#9A9AA6">Total HT</td>
          <td style="padding:12px 0 0;font-size:13px;color:#26262E;text-align:right;font-weight:600">${fmt(data.totalHT)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:6px 0;font-size:13px;color:#9A9AA6">${vatRowLabel(data.terms)}</td>
          <td style="padding:6px 0;font-size:13px;color:#26262E;text-align:right;font-weight:600">${fmt(data.tva)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:12px 14px;font-size:14px;font-weight:800;color:#FFFFFF;background:#131318">Total TTC</td>
          <td style="padding:12px 14px;font-size:14px;font-weight:800;color:#FFFFFF;text-align:right;background:#131318">${fmt(data.totalTTC)}</td>
        </tr>
      </table>

      ${ctaButton(`${SITE_URL}/fr/devis/signature/${data.signToken}`, `Consulter et signer mon ${noun(data.kind)}`)}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(`Question sur le ${noun(data.kind)} ${data.numero}`)}`, `Une question sur ce ${noun(data.kind)} ?`)}
    `),
  }
}

// ── Quote signed electronically (client) ────────────────────────────────────

export function quoteSignedClientEmail(data: {
  numero: string
  accessCode: string
  clientNom: string
  totalTTC: number
  kind?: string
}, adminEmail: string) {
  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
  const safeNom = esc(data.clientNom)

  return {
    subject: `Votre ${noun(data.kind)} ${data.numero} a bien été signé`,
    html: base(`${Noun(data.kind)} signé`, `Votre signature du ${noun(data.kind)} ${data.numero} a bien été enregistrée`, `
      ${badge(`${Noun(data.kind)} ${esc(data.numero)}`)}
      ${heading(`C&rsquo;est sign&eacute;, ${safeNom.split(' ')[0]}&nbsp;!`)}
      ${intro(`Votre signature &eacute;lectronique a &eacute;t&eacute; enregistr&eacute;e avec succ&egrave;s. Ce ${noun(data.kind)} vaut d&eacute;sormais confirmation de commande pour un montant de <strong style="color:#26262E">${fmt(data.totalTTC)}</strong> TTC. Le contrat sign&eacute; est joint &agrave; cet e-mail au format PDF.`)}

      ${infoBox(`
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Code de suivi</p>
        <p style="margin:0;font-size:22px;font-weight:800;color:#131318;letter-spacing:0.12em;font-family:'Courier New',Courier,monospace">${esc(data.accessCode)}</p>
      `)}

      ${ctaButton(`${SITE_URL}/fr/devis?ref=${encodeURIComponent(data.accessCode)}`, 'Voir le document signé')}
      ${secondaryLink(`${SITE_URL}/fr/suivi?ref=${encodeURIComponent(data.accessCode)}`, "Suivre l'avancement du projet")}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(`À propos du devis ${data.numero}`)}`, 'Une question ?')}
    `),
  }
}

// ── Quote signed electronically (admin) ─────────────────────────────────────

export function quoteSignedAdminEmail(data: {
  numero: string
  clientNom: string
  totalTTC: number
  signature?: { name: string; signedAt: string }
  kind?: string
}) {
  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
  const safeNom = esc(data.clientNom)
  const signedBy = data.signature ? esc(data.signature.name) : safeNom
  const signedAt = data.signature
    ? new Date(data.signature.signedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' })
    : ''

  return {
    subject: `${Noun(data.kind)} ${data.numero} signé par ${data.clientNom}`,
    html: base(`${Noun(data.kind)} signé`, `${signedBy} a signé électroniquement le ${noun(data.kind)} ${data.numero}`, `
      ${badge('Signature &eacute;lectronique')}
      ${heading(`Un ${noun(data.kind)} vient d&rsquo;&ecirc;tre sign&eacute;`)}
      ${intro(`<strong style="color:#26262E">${signedBy}</strong> a sign&eacute; &eacute;lectroniquement le ${noun(data.kind)} <strong style="color:#26262E">${esc(data.numero)}</strong>${signedAt ? ` le ${signedAt}` : ''}, pour un montant de <strong style="color:#26262E">${fmt(data.totalTTC)}</strong> TTC. Vous pouvez maintenant &eacute;mettre la facture d&rsquo;acompte depuis le tableau de bord.`)}

      ${ctaButton(`${SITE_URL}/admin/quotes`, 'Voir dans le tableau de bord')}
    `),
  }
}

// ── Quote declined from the signing page (admin) ────────────────────────────

export function quoteDeclinedAdminEmail(data: { numero: string; clientNom: string }) {
  const safeNom = esc(data.clientNom)

  return {
    subject: `Devis ${data.numero} refusé par ${data.clientNom}`,
    html: base('Devis refusé', `${safeNom} a refusé le devis ${data.numero}`, `
      ${badge('Devis refus&eacute;')}
      ${heading('Un devis a &eacute;t&eacute; refus&eacute;')}
      ${intro(`<strong style="color:#26262E">${safeNom}</strong> a refus&eacute; le devis <strong style="color:#26262E">${esc(data.numero)}</strong> depuis la page de signature.`)}

      ${ctaButton(`${SITE_URL}/admin/quotes`, 'Voir dans le tableau de bord')}
    `),
  }
}

// ── Quote accepted → confirmation / contract (client) ────────────────────────
// Sent automatically the moment an admin flips a quote's status to
// "accepted" — the client gets a confirmation they can open, print, or sign
// (same document as the devis, now framed as a contract).

export function quoteAcceptedEmail(data: {
  numero: string
  accessCode: string
  clientNom: string
  totalTTC: number
}, adminEmail: string) {
  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
  const safeNom = esc(data.clientNom)

  return {
    subject: `Devis accepté — contrat ${data.numero}`,
    html: base('Devis accepté', `Votre devis ${data.numero} a été accepté — voici votre contrat`, `
      ${badge(`Devis ${esc(data.numero)}`)}
      ${heading(`C&rsquo;est parti, ${safeNom.split(' ')[0]}&nbsp;!`)}
      ${intro(`Votre devis a &eacute;t&eacute; accept&eacute; et vaut d&eacute;sormais confirmation de commande. Retrouvez le contrat correspondant &agrave; tout moment avec votre code de suivi.`)}

      ${infoBox(`
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Code de suivi</p>
        <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#131318;letter-spacing:0.12em;font-family:'Courier New',Courier,monospace">${esc(data.accessCode)}</p>
        <p style="margin:0;font-size:12px;color:#9A9AA6;line-height:1.6">Montant total accept&eacute; : <strong style="color:#26262E">${fmt(data.totalTTC)}</strong> TTC.</p>
      `)}

      ${ctaButton(`${SITE_URL}/fr/devis?ref=${encodeURIComponent(data.accessCode)}`, 'Voir mon contrat')}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(`À propos du devis ${data.numero}`)}`, 'Une question ?')}
    `),
  }
}

// ── Delivery → procès-verbal de recette (client) ─────────────────────────────

export function deliveryEmail(data: {
  numero: string
  deliveryToken: string
  clientNom: string
  kind?: string
  delivery?: { deliveredAt: string; note?: string; liveUrl?: string }
}, adminEmail: string) {
  const safeNom = esc(data.clientNom)
  const liveUrl = data.delivery?.liveUrl ? esc(data.delivery.liveUrl) : undefined
  const note = data.delivery?.note ? esc(data.delivery.note) : undefined

  return {
    subject: `Votre projet est livré — procès-verbal de recette ${data.numero}`,
    html: base('Projet livré', `Votre projet est livré : merci de signer le procès-verbal de recette`, `
      ${badge(`${Noun(data.kind)} ${esc(data.numero)}`)}
      ${heading(`Votre projet est livr&eacute;, ${safeNom.split(' ')[0]}&nbsp;!`)}
      ${intro(`Les prestations pr&eacute;vues sont livr&eacute;es. Merci de les v&eacute;rifier puis de signer le proc&egrave;s-verbal de recette (joint en PDF) &mdash; avec ou sans r&eacute;serves &mdash; depuis le lien ci-dessous. &Agrave; d&eacute;faut de retour sous <strong style="color:#26262E">7 jours ouvr&eacute;s</strong>, la livraison est r&eacute;put&eacute;e accept&eacute;e.`)}

      ${liveUrl || note ? infoBox(`
        ${liveUrl ? `<p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Acc&egrave;s</p><p style="margin:0 0 ${note ? '14px' : '0'};font-size:14px"><a href="${liveUrl}" style="color:#131318;font-weight:600">${liveUrl}</a></p>` : ''}
        ${note ? `<p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Remarques</p><p style="margin:0;font-size:14px;color:#3A3A44;line-height:1.7;white-space:pre-wrap">${note}</p>` : ''}
      `) : ''}

      ${ctaButton(`${SITE_URL}/fr/recette/${data.deliveryToken}`, 'Consulter et signer le procès-verbal de recette')}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(`Livraison ${data.numero}`)}`, 'Signaler un problème')}
    `),
  }
}

// ── Recette signed (client + admin) ──────────────────────────────────────────

export function acceptanceSignedClientEmail(data: {
  numero: string
  deliveryToken: string
  accessCode: string
  clientNom: string
  kind?: string
  acceptance?: { reserves?: string }
}, adminEmail: string) {
  const safeNom = esc(data.clientNom)
  const withReserves = !!data.acceptance?.reserves

  return {
    subject: `Recette ${withReserves ? 'avec réserves ' : ''}enregistrée — ${data.numero}`,
    html: base('Recette enregistrée', `Votre procès-verbal de recette ${data.numero} a bien été enregistré`, `
      ${badge(`${Noun(data.kind)} ${esc(data.numero)}`)}
      ${heading(`Merci, ${safeNom.split(' ')[0]}&nbsp;!`)}
      ${intro(withReserves
        ? 'Votre proc&egrave;s-verbal de recette a &eacute;t&eacute; enregistr&eacute; <strong style="color:#26262E">avec r&eacute;serves</strong>. Elles seront trait&eacute;es dans le cadre de la garantie. Le proc&egrave;s-verbal sign&eacute; est joint &agrave; cet e-mail.'
        : 'Votre proc&egrave;s-verbal de recette a &eacute;t&eacute; enregistr&eacute; <strong style="color:#26262E">sans r&eacute;serve</strong>. Le proc&egrave;s-verbal sign&eacute; est joint &agrave; cet e-mail. La facture de solde vous sera adress&eacute;e s&rsquo;il y a lieu.')}

      ${ctaButton(`${SITE_URL}/fr/recette/${data.deliveryToken}`, 'Voir le procès-verbal signé')}
      ${secondaryLink(`${SITE_URL}/fr/suivi?ref=${encodeURIComponent(data.accessCode)}`, "Suivre l'avancement du projet")}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(`À propos de la recette ${data.numero}`)}`, 'Une question ?')}
    `),
  }
}

export function acceptanceSignedAdminEmail(data: {
  numero: string
  clientNom: string
  kind?: string
  acceptance?: { name: string; reserves?: string }
}) {
  const safeNom = esc(data.acceptance?.name ?? data.clientNom)
  const reserves = data.acceptance?.reserves

  return {
    subject: `Recette ${reserves ? 'AVEC RÉSERVES ' : ''}signée — ${data.numero} — ${data.clientNom}`,
    html: base('Recette signée', `${safeNom} a signé le procès-verbal de recette ${data.numero}`, `
      ${badge('Recette')}
      ${heading(reserves ? 'Recette sign&eacute;e avec r&eacute;serves' : 'Recette sign&eacute;e sans r&eacute;serve')}
      ${intro(`<strong style="color:#26262E">${safeNom}</strong> a sign&eacute; le proc&egrave;s-verbal de recette du ${noun(data.kind)} <strong style="color:#26262E">${esc(data.numero)}</strong>. ${reserves ? '' : 'Vous pouvez &eacute;mettre la facture de solde.'}`)}

      ${reserves ? infoBox(`
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">R&eacute;serves du client</p>
        <p style="margin:0;font-size:14px;color:#3A3A44;line-height:1.8;white-space:pre-wrap">${esc(reserves)}</p>
      `) : ''}

      ${ctaButton(`${SITE_URL}/admin/quotes`, 'Voir dans le tableau de bord')}
    `),
  }
}

// ── Invoice + receipt (client) ───────────────────────────────────────────────

const fmtFcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' })

interface InvoiceMailData {
  numero: string
  quoteNumero: string
  kind: 'acompte' | 'solde'
  dueAt: string
  netToPay: number
  client: { nom: string }
  terms: { paymentMethods: string; paymentDetails: string }
  payment?: { paidAt: string; method: string; receiptNumero: string }
}

export function invoiceEmail(data: InvoiceMailData, adminEmail: string) {
  const safeNom = esc(data.client.nom)
  const label = data.kind === 'acompte' ? 'd&rsquo;acompte' : 'de solde'

  return {
    subject: `Facture ${data.kind === 'acompte' ? "d'acompte" : 'de solde'} ${data.numero} — ${fmtFcfa(data.netToPay)}`,
    html: base('Votre facture', `Facture ${data.numero} — ${fmtFcfa(data.netToPay)} ${data.kind === 'acompte' ? 'à régler dès réception' : `à régler avant le ${shortDate(data.dueAt)}`}`, `
      ${badge(`Facture ${esc(data.numero)}`)}
      ${heading(`Votre facture ${label}`)}
      ${intro(`Bonjour ${safeNom.split(' ')[0]}, vous trouverez ci-joint la facture ${label} relative au devis <strong style="color:#26262E">${esc(data.quoteNumero)}</strong>.`)}

      ${infoBox(`
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Montant &agrave; r&eacute;gler</p>
        <p style="margin:0 0 14px;font-size:22px;font-weight:800;color:#131318">${fmtFcfa(data.netToPay)}</p>
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">&Eacute;ch&eacute;ance</p>
        <p style="margin:0 0 14px;font-size:14px;color:#26262E">${data.kind === 'acompte' ? 'D&egrave;s r&eacute;ception (le d&eacute;veloppement d&eacute;bute apr&egrave;s le paiement)' : esc(shortDate(data.dueAt))}</p>
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Moyens de paiement</p>
        <p style="margin:0;font-size:13.5px;color:#26262E;line-height:1.6;white-space:pre-wrap">${esc(data.terms.paymentMethods)}${data.terms.paymentDetails ? `\n${esc(data.terms.paymentDetails)}` : ''}</p>
      `)}

      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(`Facture ${data.numero}`)}`, 'Une question sur cette facture ?')}
    `),
  }
}

export function receiptEmail(data: InvoiceMailData, adminEmail: string) {
  const safeNom = esc(data.client.nom)
  const receipt = data.payment?.receiptNumero ?? ''

  return {
    subject: `Reçu de paiement ${receipt} — ${fmtFcfa(data.netToPay)}`,
    html: base('Paiement reçu', `Nous avons bien reçu votre paiement de ${fmtFcfa(data.netToPay)}`, `
      ${badge(`Reçu ${esc(receipt)}`)}
      ${heading(`Paiement re&ccedil;u, merci ${safeNom.split(' ')[0]}&nbsp;!`)}
      ${intro(`Nous avons bien re&ccedil;u votre r&egrave;glement de <strong style="color:#26262E">${fmtFcfa(data.netToPay)}</strong>${data.payment ? ` le ${esc(shortDate(data.payment.paidAt))} (${esc(data.payment.method)})` : ''}, pour la facture <strong style="color:#26262E">${esc(data.numero)}</strong>. Le re&ccedil;u est joint &agrave; cet e-mail.`)}

      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent(`Reçu ${receipt}`)}`, 'Une question ?')}
    `),
  }
}

// ── Testimonial request (client) — manual trigger, automated content ────────
// The admin decides *when* to ask (after actually delivering the project),
// but never has to write the email by hand.

export function testimonialRequestEmail(data: { clientNom: string; numero: string }, adminEmail: string) {
  const safeNom = esc(data.clientNom)
  const firstName = safeNom.split(' ')[0]

  return {
    subject: `${firstName}, un avis sur notre collaboration ?`,
    html: base('Votre avis compte', `Un petit mot sur votre expérience avec Nawaf Nemrod SALAMI ?`, `
      ${badge(`Devis ${esc(data.numero)}`)}
      ${heading(`Un avis, ${firstName}&nbsp;?`)}
      ${intro(`J&rsquo;esp&egrave;re que notre collaboration s&rsquo;est bien pass&eacute;e&nbsp;! Si vous avez deux minutes, un retour honn&ecirc;te m&rsquo;aiderait &eacute;norm&eacute;ment &agrave; faire conna&icirc;tre mon travail aupr&egrave;s d&rsquo;autres clients.`)}

      ${ctaButton(`${SITE_URL}/fr/temoignage`, 'Laisser un avis')}
      ${secondaryLink(`mailto:${adminEmail}`, 'Répondre directement')}
    `),
  }
}

// ── Booking notification (admin) ───────────────────────────────────────────

function formatSlot(startISO: string): string {
  return new Date(startISO).toLocaleString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Libreville',
  })
}

export function bookingNotificationEmail(data: {
  clientNom: string
  clientEmail: string
  clientTelephone?: string
  message?: string
  start: string
  accessCode: string
  meetingUrl: string
}) {
  const safeNom = esc(data.clientNom)
  const safeEmail = esc(data.clientEmail)
  const safePhone = data.clientTelephone ? esc(data.clientTelephone) : undefined
  const when = formatSlot(data.start)

  return {
    subject: `Nouveau rendez-vous — ${data.clientNom} — ${when}`,
    html: base('Nouveau rendez-vous', `${safeNom} a réservé un créneau le ${when}`, `
      ${badge('Calendrier')}
      ${heading('Nouveau rendez-vous r&eacute;serv&eacute;')}
      ${intro(`<strong style="color:#26262E">${safeNom}</strong> vient de r&eacute;server un cr&eacute;neau sur votre calendrier.`)}

      ${infoBox(`
        ${dataRow(icon.clock, 'Cr&eacute;neau', `<strong>${esc(when)}</strong>`)}
        ${dataRow(icon.user, 'Client', `<strong>${safeNom}</strong>`)}
        ${dataRow(icon.mail, 'Email', `<a href="mailto:${safeEmail}" style="color:#131318;text-decoration:underline;font-weight:600">${safeEmail}</a>`)}
        ${safePhone ? dataRow(phone, 'T&eacute;l&eacute;phone', `<a href="tel:${safePhone}" style="color:#131318;text-decoration:underline;font-weight:600">${safePhone}</a>`) : ''}
        ${dataRow(icon.video, 'Visioconf&eacute;rence', `<a href="${esc(data.meetingUrl)}" style="color:#131318;text-decoration:underline;font-weight:600">Rejoindre le salon</a>`)}
      `)}

      ${data.message ? infoBox(`
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Message</p>
        <p style="margin:0;font-size:14px;color:#3A3A44;line-height:1.8;white-space:pre-wrap">${esc(data.message)}</p>
      ` ) : ''}

      ${ctaButton(`mailto:${safeEmail}?subject=${encodeURIComponent('Votre rendez-vous')}`, `Contacter ${safeNom}`)}
      ${secondaryLink(`mailto:${safeEmail}`, "Copier l'email")}
    `),
  }
}

// ── Booking copy (client) ───────────────────────────────────────────────────

export function bookingClientCopyEmail(data: {
  clientNom: string
  message?: string
  start: string
  accessCode: string
  meetingUrl: string
}, adminEmail: string) {
  const safeNom = esc(data.clientNom)
  const when = formatSlot(data.start)

  return {
    subject: `Votre rendez-vous est confirmé — ${when}`,
    html: base('Rendez-vous confirmé', `Votre rendez-vous est confirmé pour le ${when}`, `
      ${badge('Rendez-vous confirm&eacute;')}
      ${heading(`C&rsquo;est confirm&eacute;, ${safeNom.split(' ')[0]}&nbsp;!`)}
      ${intro(`Votre rendez-vous avec Nawaf Nemrod SALAMI est bien enregistr&eacute;. Un fichier calendrier est joint &agrave; cet e-mail pour l&rsquo;ajouter directement &agrave; votre agenda — le lien de visioconf&eacute;rence y est d&eacute;j&agrave; inclus.`)}

      ${infoBox(`
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Cr&eacute;neau</p>
        <p style="margin:0 0 16px;font-size:16px;font-weight:800;color:#131318">${esc(when)}</p>
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Code de suivi</p>
        <p style="margin:0 0 16px;font-size:22px;font-weight:800;color:#131318;letter-spacing:0.12em;font-family:'Courier New',Courier,monospace">${esc(data.accessCode)}</p>
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Visioconf&eacute;rence</p>
        <p style="margin:0;font-size:13px"><a href="${esc(data.meetingUrl)}" style="color:#131318;text-decoration:underline;font-weight:600">${esc(data.meetingUrl)}</a></p>
        <p style="margin:8px 0 0;font-size:12px;color:#9A9AA6;line-height:1.6">Conservez le code ci-dessus : donnez-le au chatbot du portfolio pour retrouver ou annuler ce rendez-vous.</p>
      `)}

      ${ctaButton(data.meetingUrl, 'Rejoindre la visioconférence')}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent('À propos de mon rendez-vous')}`, 'Une question ?')}
    `),
  }
}

// ── Booking reminder (client) ───────────────────────────────────────────────

export function bookingReminderEmail(data: {
  clientNom: string
  start: string
  accessCode: string
  meetingUrl: string
}, adminEmail: string) {
  const safeNom = esc(data.clientNom)
  const when = formatSlot(data.start)

  return {
    subject: `Rappel — votre rendez-vous ${when}`,
    html: base('Rappel de rendez-vous', `Votre rendez-vous approche — ${when}`, `
      ${badge('Rappel')}
      ${heading(`&Agrave; bient&ocirc;t, ${safeNom.split(' ')[0]}&nbsp;!`)}
      ${intro(`Petit rappel : votre rendez-vous avec Nawaf Nemrod SALAMI approche.`)}

      ${infoBox(`
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Cr&eacute;neau</p>
        <p style="margin:0 0 16px;font-size:16px;font-weight:800;color:#131318">${esc(when)}</p>
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Code de suivi</p>
        <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#131318;letter-spacing:0.1em;font-family:'Courier New',Courier,monospace">${esc(data.accessCode)}</p>
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Visioconf&eacute;rence</p>
        <p style="margin:0;font-size:13px"><a href="${esc(data.meetingUrl)}" style="color:#131318;text-decoration:underline;font-weight:600">${esc(data.meetingUrl)}</a></p>
      `)}

      ${ctaButton(data.meetingUrl, 'Rejoindre la visioconférence')}
      ${secondaryLink(`mailto:${adminEmail}?subject=${encodeURIComponent('À propos de mon rendez-vous')}`, 'Besoin de le déplacer ?')}
    `),
  }
}

// ── Waitlist — a slot opened up ─────────────────────────────────────────────

export function waitlistSlotOpenEmail(data: { date: string; name?: string }) {
  const dayLabel = new Date(`${data.date}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville',
  })
  const greeting = data.name ? esc(data.name.split(' ')[0]) : 'Bonjour'

  return {
    subject: `Une place s'est libérée — ${dayLabel}`,
    html: base('Une place vient de se libérer', `Un créneau vient de se libérer le ${dayLabel}`, `
      ${badge('Liste d’attente')}
      ${heading(`${greeting}, une place vient de se lib&eacute;rer&nbsp;!`)}
      ${intro(`Vous vous &eacute;tiez inscrit sur la liste d&rsquo;attente pour le <strong style="color:#26262E">${dayLabel}</strong> — un cr&eacute;neau vient tout juste de se lib&eacute;rer ce jour-l&agrave;. Les places partent vite, r&eacute;servez d&egrave;s maintenant si &ccedil;a vous int&eacute;resse toujours.`)}

      ${ctaButton(`${SITE_URL}/fr/calendrier`, 'Réserver ce créneau')}
    `),
  }
}

// ── Chatbot escalation — visitor wants a human ──────────────────────────────

export function escalationEmail(data: { reason: string; clientNom: string; clientEmail: string; clientTelephone?: string }) {
  const safeReason = esc(data.reason)
  const safeNom = esc(data.clientNom)
  const safeEmail = esc(data.clientEmail)
  const safePhone = data.clientTelephone ? esc(data.clientTelephone) : undefined

  return {
    subject: `⚡ ${data.clientNom} veut vous parler directement`,
    html: base('Demande directe', `${safeNom} souhaite vous parler directement`, `
      ${badge('Chatbot · Urgent')}
      ${heading('Un visiteur veut vous parler directement')}
      ${intro('Le chatbot n\'a pas pu r&eacute;pondre lui-m&ecirc;me, ou le visiteur a explicitement demand&eacute; &agrave; vous joindre. Voici ses coordonn&eacute;es pour le recontacter.')}

      ${infoBox(`
        ${dataRow(icon.user, 'Nom', `<strong>${safeNom}</strong>`)}
        ${dataRow(icon.mail, 'Email', `<a href="mailto:${safeEmail}" style="color:#131318;text-decoration:underline;font-weight:600">${safeEmail}</a>`)}
        ${safePhone ? dataRow(phone, 'T&eacute;l&eacute;phone', `<a href="tel:${safePhone}" style="color:#131318;text-decoration:underline;font-weight:600">${safePhone}</a>`) : ''}
      `)}

      ${infoBox(`
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#B0B0BB;letter-spacing:0.09em;text-transform:uppercase">Contexte</p>
        <p style="margin:0;font-size:14px;color:#3A3A44;line-height:1.8;white-space:pre-wrap">${safeReason}</p>
      `)}

      ${ctaButton(`mailto:${safeEmail}`, 'Répondre au visiteur')}
    `),
  }
}
