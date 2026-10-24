// The WhatsApp message that asks a client for a review once their project is delivered and signed
// off. The owner sends it themselves (the admin only opens WhatsApp with the text written): nothing
// is sent from the site. The link leads to the public review page, in the client's language.

export type ReviewLocale = 'fr' | 'en'

/** The first word of the client's name, or nothing when the name is not usable. */
function firstName(name?: string | null): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? ''
  return first.length >= 2 && first.length <= 40 ? first : ''
}

export function reviewPageUrl(siteUrl: string, locale: ReviewLocale): string {
  return `${siteUrl.replace(/\/+$/, '')}/${locale}/temoignage`
}

export function reviewRequestWhatsApp(input: { clientName?: string | null; locale: ReviewLocale; reviewUrl: string; ownerName?: string | null }): string {
  const hello = firstName(input.clientName)
  const owner = (input.ownerName ?? '').trim().split(/\s+/)[0] || 'Nawaf'
  if (input.locale === 'en') {
    return [
      `Hello${hello ? ` ${hello}` : ''} 👋`,
      '',
      'I hope you are happy with your project! If you have two minutes, an honest review would help me a lot to make my work known to other clients:',
      input.reviewUrl,
      '',
      `Thank you!`,
      owner,
    ].join('\n')
  }
  return [
    `Bonjour${hello ? ` ${hello}` : ''} 👋`,
    '',
    'J’espère que vous êtes satisfait(e) de votre projet ! Si vous avez deux minutes, un avis sincère m’aiderait beaucoup à faire connaître mon travail auprès d’autres clients :',
    input.reviewUrl,
    '',
    'Merci d’avance !',
    owner,
  ].join('\n')
}
