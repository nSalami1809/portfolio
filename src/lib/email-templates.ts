function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ── SVG Icons ──────────────────────────────────────────────────────────────

const icon = {
  shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  user: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  mail: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  tag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.28-8.28a1 1 0 0 0 0-1.42Z"/><path d="M7 7h.01"/></svg>`,
  message: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6B7A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  reply: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`,
  alert: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
}

// ── Base layout ────────────────────────────────────────────────────────────

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
      .wrapper{padding:24px 12px!important}
      .card{padding:28px 20px!important;border-radius:16px!important}
      .otp-box{width:38px!important;height:48px!important;font-size:22px!important}
      .meta-row td{display:block!important;padding:8px 16px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#07070B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">

  <div style="display:none;max-height:0;overflow:hidden;color:#07070B">${preheader}&nbsp;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;&zwnj;</div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td class="wrapper" style="padding:48px 16px 64px">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto">

          <!-- Wordmark -->
          <tr>
            <td style="padding-bottom:32px;text-align:center">
              <table cellpadding="0" cellspacing="0" role="presentation" style="display:inline-table">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle">
                    <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#8B5CF6 0%,#5B21B6 100%);text-align:center;line-height:40px">
                      <span style="color:#fff;font-size:18px">${icon.shield}</span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;text-align:left">
                    <p style="margin:0;font-size:15px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px">Nawaf Nemrod SALAMI</p>
                    <p style="margin:2px 0 0;font-size:10px;color:#3A3A4A;letter-spacing:0.12em;text-transform:uppercase">Portfolio &middot; Libreville, Gabon</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td>
              <table class="card" width="100%" cellpadding="0" cellspacing="0" role="presentation"
                style="background:#0E0E18;border:1px solid rgba(139,92,246,0.16);border-radius:22px;overflow:hidden">
                <!-- Gradient top bar -->
                <tr><td style="height:2px;background:linear-gradient(90deg,transparent 0%,#8B5CF6 30%,#3B82F6 70%,transparent 100%)"></td></tr>
                <tr>
                  <td class="card" style="padding:40px 36px">
                    ${body}
                  </td>
                </tr>
                <!-- Gradient bottom bar -->
                <tr><td style="height:1px;background:linear-gradient(90deg,transparent 0%,rgba(139,92,246,0.3) 50%,transparent 100%)"></td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center">
              <p style="margin:0 0 6px;font-size:11px;color:#252530;letter-spacing:0.06em">
                &copy; ${year} &nbsp;&middot;&nbsp; Nawaf Nemrod SALAMI &nbsp;&middot;&nbsp; Libreville, Gabon
              </p>
              <p style="margin:0;font-size:10px;color:#1E1E28">
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

// ── Shared helpers ─────────────────────────────────────────────────────────

const sectionDivider = `
<tr><td style="padding:20px 0">
  <div style="height:1px;background:linear-gradient(90deg,transparent,#16161F 20%,#16161F 80%,transparent)"></div>
</td></tr>`

const iconRow = (ico: string, label: string, value: string, color = '#8B5CF6') => `
  <tr>
    <td style="padding:0 0 0 0">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
        style="background:#07070B;border:1px solid #16161F;border-radius:12px;margin-bottom:10px;overflow:hidden">
        <tr>
          <td style="width:44px;padding:16px 0 16px 16px;vertical-align:middle">
            <div style="width:28px;height:28px;border-radius:7px;background:rgba(${color === '#8B5CF6' ? '139,92,246' : color === '#3B82F6' ? '59,130,246' : color === '#10B981' ? '16,185,129' : '245,158,11'},0.12);text-align:center;line-height:28px">
              ${ico}
            </div>
          </td>
          <td style="padding:14px 16px 14px 10px;vertical-align:middle">
            <p style="margin:0 0 2px;font-size:10px;font-weight:600;color:#3A3A4A;letter-spacing:0.1em;text-transform:uppercase">${label}</p>
            <p style="margin:0;font-size:13px;color:#E2E2F0;line-height:1.4">${value}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`

// ── OTP Login ──────────────────────────────────────────────────────────────

export function otpEmail(otp: string) {
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Libreville' })

  const boxes = otp.split('').map((d) => `
    <td style="padding:0 5px">
      <div class="otp-box" style="width:52px;height:64px;line-height:64px;border-radius:14px;background:#07070B;border:1.5px solid rgba(139,92,246,0.45);text-align:center;font-size:30px;font-weight:700;font-family:'Courier New',Courier,monospace;color:#FFFFFF;letter-spacing:0">
        ${d}
      </div>
    </td>`).join('')

  return {
    subject: `[${otp}] Code de connexion — Portfolio NS`,
    html: base('Code de connexion', `Votre code OTP est ${otp} — valable 10 min`, `

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">

        <!-- Header badge -->
        <tr>
          <td style="padding-bottom:8px">
            <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);color:#A78BFA;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:5px 12px;border-radius:99px">
              ${icon.shield}&nbsp; Authentification
            </span>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:8px">
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2">Code de connexion</h1>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:32px">
            <p style="margin:0;font-size:14px;color:#6B6B7A;line-height:1.7">
              Une tentative de connexion a &eacute;t&eacute; d&eacute;tect&eacute;e sur votre panneau d&rsquo;administration.<br/>
              Saisissez ce code pour confirmer votre identit&eacute;.
            </p>
          </td>
        </tr>

        <!-- OTP display -->
        <tr>
          <td style="padding-bottom:28px">
            <div style="background:#07070B;border:1px solid rgba(139,92,246,0.2);border-radius:18px;padding:32px 24px;text-align:center">
              <p style="margin:0 0 6px;font-size:10px;font-weight:600;color:#3A3A4A;letter-spacing:0.16em;text-transform:uppercase">Code &agrave; usage unique</p>
              <p style="margin:0 0 24px;font-size:11px;color:#4A4A5A">Saisissez les 6 chiffres ci-dessous</p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto">
                <tr>${boxes}</tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Metadata grid -->
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="background:#07070B;border:1px solid #16161F;border-radius:14px;overflow:hidden">
              <tr class="meta-row">
                <td style="padding:14px 20px;border-right:1px solid #16161F;border-bottom:1px solid #16161F;width:50%">
                  <p style="margin:0 0 3px;font-size:10px;color:#3A3A4A;letter-spacing:0.1em;text-transform:uppercase">${icon.clock}&nbsp; Expiration</p>
                  <p style="margin:0;font-size:12px;color:#E2E2F0;font-weight:600">10 minutes</p>
                </td>
                <td style="padding:14px 20px;border-bottom:1px solid #16161F">
                  <p style="margin:0 0 3px;font-size:10px;color:#3A3A4A;letter-spacing:0.1em;text-transform:uppercase">${icon.clock}&nbsp; Horodatage</p>
                  <p style="margin:0;font-size:12px;color:#E2E2F0;font-weight:600">${now}</p>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:14px 20px">
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding-right:8px;vertical-align:top;padding-top:1px">${icon.alert}</td>
                      <td>
                        <p style="margin:0;font-size:12px;color:#6B6B7A;line-height:1.6">
                          Si vous n&rsquo;&ecirc;tes pas &agrave; l&rsquo;origine de cette demande,&nbsp;
                          <strong style="color:#F59E0B">ignorez cet e-mail</strong>. Personne d&rsquo;autre n&rsquo;a acc&egrave;s &agrave; votre compte.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
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

const SUBJECT_COLORS: Record<string, string> = {
  mission: '#8B5CF6',
  collaboration: '#3B82F6',
  conseil: '#10B981',
  autre: '#F59E0B',
}

const phone = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`

export function contactNotificationEmail(data: {
  name: string; email: string; phone?: string; subject: string; customSubject?: string; message: string
}) {
  const rawLabel = data.subject === 'autre' && data.customSubject
    ? data.customSubject
    : (SUBJECT_LABELS[data.subject] ?? data.subject)
  const label = esc(rawLabel)
  const accent = SUBJECT_COLORS[data.subject] ?? '#8B5CF6'
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Libreville' })
  const wordCount = data.message.trim().split(/\s+/).length
  const safeName    = esc(data.name)
  const safeEmail   = esc(data.email)
  const safePhone   = data.phone ? esc(data.phone) : undefined
  const safeMessage = esc(data.message)

  return {
    subject: `✉️ Nouveau message — ${rawLabel} — ${data.name}`,
    html: base('Nouveau message de contact', `${data.name} vous a envoyé un message via votre portfolio`, `

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">

        <!-- Header badge -->
        <tr>
          <td style="padding-bottom:8px">
            <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);color:#60A5FA;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:5px 12px;border-radius:99px">
              ${icon.mail}&nbsp; Formulaire de contact
            </span>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:6px">
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2">Nouveau message re&ccedil;u</h1>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:28px">
            <p style="margin:0;font-size:14px;color:#6B6B7A;line-height:1.7">
              <strong style="color:#9CA3AF">${safeName}</strong> a utilis&eacute; votre formulaire de contact le ${now}.
            </p>
          </td>
        </tr>

        <!-- Stats row -->
        <tr>
          <td style="padding-bottom:24px">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="background:#07070B;border:1px solid #16161F;border-radius:14px;overflow:hidden">
              <tr>
                <td style="padding:16px 20px;border-right:1px solid #16161F;text-align:center">
                  <p style="margin:0 0 3px;font-size:22px;font-weight:800;color:#FFFFFF">1</p>
                  <p style="margin:0;font-size:10px;color:#3A3A4A;letter-spacing:0.1em;text-transform:uppercase">message</p>
                </td>
                <td style="padding:16px 20px;border-right:1px solid #16161F;text-align:center">
                  <p style="margin:0 0 3px;font-size:22px;font-weight:800;color:#FFFFFF">${wordCount}</p>
                  <p style="margin:0;font-size:10px;color:#3A3A4A;letter-spacing:0.1em;text-transform:uppercase">mots</p>
                </td>
                <td style="padding:16px 20px;text-align:center">
                  <p style="margin:0 0 3px">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin-right:4px;vertical-align:middle"></span>
                    <span style="font-size:11px;font-weight:700;color:#10B981">Non lu</span>
                  </p>
                  <p style="margin:0;font-size:10px;color:#3A3A4A;letter-spacing:0.1em;text-transform:uppercase">statut</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Sender info -->
        <tr>
          <td style="padding-bottom:8px">
            <p style="margin:0;font-size:10px;font-weight:600;color:#3A3A4A;letter-spacing:0.12em;text-transform:uppercase">Informations de l&rsquo;exp&eacute;diteur</p>
          </td>
        </tr>

        ${iconRow(icon.user, 'Nom', `<strong style="color:#E2E2F0">${safeName}</strong>`)}
        ${iconRow(icon.mail, 'Email', `<a href="mailto:${safeEmail}" style="color:#60A5FA;text-decoration:none;font-weight:500">${safeEmail}</a>`, '#3B82F6')}
        ${safePhone ? iconRow(phone, 'T&eacute;l&eacute;phone', `<a href="tel:${safePhone}" style="color:#A78BFA;text-decoration:none;font-weight:500">${safePhone}</a>`, '#8B5CF6') : ''}
        ${iconRow(icon.tag, 'Sujet', `
          <span style="display:inline-block;background:${accent}1A;border:1px solid ${accent}33;color:${accent};font-size:11px;font-weight:600;padding:3px 10px;border-radius:6px;letter-spacing:0.06em;text-transform:uppercase">
            ${label}
          </span>`, '#10B981')}

        <!-- Message -->
        ${sectionDivider}
        <tr>
          <td style="padding-bottom:12px">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding-right:8px;vertical-align:middle">${icon.message}</td>
                <td><p style="margin:0;font-size:10px;font-weight:600;color:#3A3A4A;letter-spacing:0.12em;text-transform:uppercase">Message</p></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:32px">
            <div style="background:#07070B;border:1px solid #16161F;border-left:3px solid ${accent};border-radius:0 12px 12px 0;padding:20px 24px">
              <p style="margin:0;font-size:14px;color:#C8C8D8;line-height:1.85;white-space:pre-wrap">${safeMessage}</p>
            </div>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding-right:8px">
                  <a href="mailto:${safeEmail}?subject=Re%3A+${encodeURIComponent(rawLabel)}&body=Bonjour+${encodeURIComponent(data.name)}%2C%0A%0A"
                    style="display:block;text-align:center;background:linear-gradient(135deg,#8B5CF6 0%,#5B21B6 100%);color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.04em;padding:14px 24px;border-radius:10px;text-decoration:none">
                    ${icon.reply}&nbsp;&nbsp;R&eacute;pondre &agrave; ${safeName}
                  </a>
                </td>
                <td style="width:140px">
                  <a href="mailto:${safeEmail}"
                    style="display:block;text-align:center;background:transparent;border:1px solid #2A2A35;color:#9CA3AF;font-size:13px;font-weight:600;padding:13px 16px;border-radius:10px;text-decoration:none">
                    Copier l&rsquo;email
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
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
  const preview = esc(data.message.length > 120 ? data.message.slice(0, 120).trimEnd() + '…' : data.message)

  return {
    subject: `Votre message a bien été reçu — Nawaf Nemrod SALAMI`,
    html: base('Message reçu', `Merci ${data.name}, votre message a bien été reçu. Je vous répondrai sous 48h.`, `

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">

        <!-- Success badge -->
        <tr>
          <td style="padding-bottom:8px">
            <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);color:#34D399;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:5px 12px;border-radius:99px">
              ${icon.check}&nbsp; Message re&ccedil;u
            </span>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:8px">
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2">Merci, ${safeName}&nbsp;!</h1>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:32px">
            <p style="margin:0;font-size:14px;color:#6B6B7A;line-height:1.8">
              Votre message a bien &eacute;t&eacute; re&ccedil;u et je m&rsquo;engage &agrave; vous r&eacute;pondre dans les <strong style="color:#9CA3AF">48 heures ouvr&eacute;es</strong>.<br/>
              En attendant, n&rsquo;h&eacute;sitez pas &agrave; consulter mes projets sur le portfolio.
            </p>
          </td>
        </tr>

        <!-- Confirmation card -->
        <tr>
          <td style="padding-bottom:28px">
            <div style="background:#07070B;border:1px solid #16161F;border-radius:16px;overflow:hidden">
              <div style="padding:14px 20px;border-bottom:1px solid #16161F;background:rgba(139,92,246,0.05)">
                <p style="margin:0;font-size:10px;font-weight:700;color:#8B5CF6;letter-spacing:0.14em;text-transform:uppercase">${icon.tag}&nbsp;&nbsp;R&eacute;capitulatif de votre demande</p>
              </div>
              <div style="padding:20px">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding-bottom:14px">
                      <p style="margin:0 0 3px;font-size:10px;color:#3A3A4A;letter-spacing:0.1em;text-transform:uppercase">Sujet</p>
                      <p style="margin:0;font-size:13px;font-weight:600;color:#E2E2F0">${label}</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="margin:0 0 8px;font-size:10px;color:#3A3A4A;letter-spacing:0.1em;text-transform:uppercase">Votre message</p>
                      <p style="margin:0;font-size:13px;color:#8A8A9A;line-height:1.7;font-style:italic">&ldquo;${preview}&rdquo;</p>
                    </td>
                  </tr>
                </table>
              </div>
            </div>
          </td>
        </tr>

        <!-- Timeline -->
        <tr>
          <td style="padding-bottom:32px">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="width:20px;padding-right:12px;vertical-align:top;padding-top:2px">
                  <div style="width:20px;height:20px;border-radius:50%;background:rgba(16,185,129,0.15);border:1.5px solid #10B981;text-align:center;line-height:18px">${icon.check}</div>
                </td>
                <td style="padding-bottom:16px">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#E2E2F0">Message envoy&eacute;</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#6B6B7A">Votre demande est bien enregistr&eacute;e.</p>
                </td>
              </tr>
              <tr>
                <td style="width:20px;padding-right:12px;vertical-align:top;padding-top:2px">
                  <div style="width:20px;height:20px;border-radius:50%;background:#16161F;border:1.5px solid #2A2A35;text-align:center;line-height:18px">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3A3A4A" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/></svg>
                  </div>
                </td>
                <td>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#6B6B7A">R&eacute;ponse sous 48h ouvr&eacute;es</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#4A4A5A">Je reviendrai vers vous par e-mail.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Signature -->
        ${sectionDivider}
        <tr>
          <td style="padding-top:4px">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding-right:14px;vertical-align:middle">
                  <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#8B5CF6 0%,#5B21B6 100%);text-align:center;line-height:42px">
                    <span style="font-size:18px;color:#fff;font-weight:800">N</span>
                  </div>
                </td>
                <td style="vertical-align:middle">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#FFFFFF">Nawaf Nemrod SALAMI</p>
                  <p style="margin:2px 0 0;font-size:11px;color:#6B6B7A">D&eacute;veloppeur Web Fullstack &amp; DevOps &nbsp;&middot;&nbsp; Libreville, Gabon</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    `),
  }
}
