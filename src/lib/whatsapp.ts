// WhatsApp links and their pre-filled messages, in one place. The site's visitors mostly reach
// the owner on WhatsApp, so every page that invites contact uses these builders: same wording,
// same cleaning of the number, same limits. Nothing here is secret: a message never carries an
// access code, a price the visitor did not see, or any personal data of the visitor.

export type WhatsAppLocale = 'fr' | 'en'

export type WhatsAppContext =
  | { kind: 'general' }
  | { kind: 'offer'; title: string; price?: string }
  | { kind: 'project'; title: string }
  | { kind: 'quote' }
  | { kind: 'guide'; title: string }
  | { kind: 'finder'; offer?: string; answers?: string }
  | { kind: 'chat'; question?: string }

/** Digits only, or '' when what is stored is not a usable number. */
export function whatsappDigits(number?: string | null): string {
  const digits = (number ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits : ''
}

/** "https://wa.me/<digits>?text=<message>", or '' without a usable number. */
export function whatsappUrl(number: string | undefined | null, message?: string): string {
  const digits = whatsappDigits(number)
  if (!digits) return ''
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}

/** The first word of the owner's name, to greet them by it. */
export function ownerFirstName(fullName?: string | null): string {
  return (fullName ?? '').trim().split(/\s+/)[0] || 'Nawaf'
}

const clip = (text: string, max: number) => {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

const TEXT = {
  fr: {
    hello: (n: string) => `Bonjour ${n} 👋`,
    bye: 'Merci !',
    yourProject: 'Mon projet en quelques mots :',
    general: 'Je vous écris depuis votre portfolio : j’aimerais discuter d’un projet avec vous.',
    offer: (title: string, price?: string) => `Je suis intéressé(e) par votre offre « ${title} »${price ? ` (${price})` : ''}. Pouvez-vous m’en dire plus sur le délai et sur la suite ?`,
    project: (title: string) => `J’ai vu votre réalisation « ${title} » et j’aimerais un projet dans le même esprit.`,
    quote: 'J’ai une question avant de demander un devis. Pouvez-vous m’aider ?',
    guide: (title: string) => `J’ai lu votre guide « ${title} » et j’ai une question sur mon propre projet.`,
    finder: (offer: string, answers?: string) => `Votre outil « Trouver mon offre » me conseille « ${offer} »${answers ? ` (${answers})` : ''}. J’aimerais en discuter avec vous.`,
    finderNone: (answers?: string) => `J’ai essayé votre outil « Trouver mon offre »${answers ? ` (${answers})` : ''} mais aucune offre ne correspond exactement à mon besoin. Pouvez-vous m’orienter ?`,
    chat: 'Je vous écris depuis l’assistant de votre portfolio : j’aimerais échanger avec vous.',
    chatQuestion: (q: string) => `Ma question : « ${q} »`,
  },
  en: {
    hello: (n: string) => `Hi ${n} 👋`,
    bye: 'Thank you!',
    yourProject: 'My project in a few words:',
    general: 'I am writing from your portfolio: I would like to discuss a project with you.',
    offer: (title: string, price?: string) => `I am interested in your “${title}” offer${price ? ` (${price})` : ''}. Could you tell me more about the timeline and the next steps?`,
    project: (title: string) => `I saw your work “${title}” and I would like a project in the same spirit.`,
    quote: 'I have a question before asking for a quote. Could you help me?',
    guide: (title: string) => `I read your guide “${title}” and I have a question about my own project.`,
    finder: (offer: string, answers?: string) => `Your “Find my offer” tool suggests “${offer}”${answers ? ` (${answers})` : ''}. I would like to discuss it with you.`,
    finderNone: (answers?: string) => `I tried your “Find my offer” tool${answers ? ` (${answers})` : ''} but no offer matches my need exactly. Could you point me in the right direction?`,
    chat: 'I am writing from your portfolio’s assistant: I would like to talk with you.',
    chatQuestion: (q: string) => `My question: “${q}”`,
  },
} as const

/**
 * The message to pre-fill. It greets the owner, says where the visitor comes from and what
 * interests them, and ends on a line for the visitor to complete before sending.
 * `pageUrl`, when given, tells the owner which page the visitor was on.
 */
export function whatsappMessage(ctx: WhatsAppContext, locale: WhatsAppLocale, owner: string, pageUrl?: string): string {
  const t = TEXT[locale]
  const lines: string[] = [t.hello(owner), '']
  switch (ctx.kind) {
    case 'offer': lines.push(t.offer(clip(ctx.title, 80), ctx.price ? clip(ctx.price, 60) : undefined)); break
    case 'project': lines.push(t.project(clip(ctx.title, 80))); break
    case 'quote': lines.push(t.quote); break
    case 'guide': lines.push(t.guide(clip(ctx.title, 90))); break
    case 'finder':
      lines.push(ctx.offer ? t.finder(clip(ctx.offer, 80), ctx.answers ? clip(ctx.answers, 120) : undefined) : t.finderNone(ctx.answers ? clip(ctx.answers, 120) : undefined))
      break
    case 'chat':
      lines.push(t.chat)
      if (ctx.question?.trim()) lines.push('', t.chatQuestion(clip(ctx.question, 200)))
      break
    default: lines.push(t.general)
  }
  // the chat already carries the visitor's own words: it does not ask for them again
  if (!(ctx.kind === 'chat' && ctx.question?.trim())) lines.push('', t.yourProject, '')
  else lines.push('')
  lines.push(t.bye)
  if (pageUrl) lines.push('', `(${clip(pageUrl, 160)})`)
  return lines.join('\n')
}

/** Convenience: the link for a context, '' without a usable number. */
export function whatsappLink(number: string | undefined | null, ctx: WhatsAppContext, locale: WhatsAppLocale, ownerName?: string | null, pageUrl?: string): string {
  return whatsappUrl(number, whatsappMessage(ctx, locale, ownerFirstName(ownerName), pageUrl))
}
