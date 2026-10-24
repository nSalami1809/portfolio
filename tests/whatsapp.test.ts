import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import WhatsAppButton from '@/components/ui/WhatsAppButton'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { ownerFirstName, whatsappDigits, whatsappLink, whatsappMessage, whatsappUrl } from '@/lib/whatsapp'

const decode = (url: string) => decodeURIComponent(url.split('?text=')[1] ?? '')

describe('the WhatsApp number', () => {
  it('keeps the digits only, from any way of writing the number', () => {
    expect(whatsappDigits('+241 07 12 34 56')).toBe('24107123456')
    expect(whatsappDigits('(241) 07-12-34-56')).toBe('24107123456')
    expect(whatsappDigits('wa.me/24107123456')).toBe('24107123456')
  })

  it('gives no link when there is no usable number', () => {
    for (const bad of [undefined, null, '', '   ', 'abc', '123']) expect(whatsappUrl(bad, 'x'), String(bad)).toBe('')
    expect(whatsappLink('', { kind: 'general' }, 'fr')).toBe('')
  })

  it('builds a wa.me link with the message encoded, or without when there is none', () => {
    expect(whatsappUrl('+241 07 12 34 56')).toBe('https://wa.me/24107123456')
    const url = whatsappUrl('+24107123456', 'Bonjour & merci\nà bientôt')
    expect(url.startsWith('https://wa.me/24107123456?text=')).toBe(true)
    expect(url).not.toMatch(/[\n ]/)
    expect(decode(url)).toBe('Bonjour & merci\nà bientôt')
  })
})

describe('the owner\'s first name', () => {
  it('is the first word of the name, with a safe fallback', () => {
    expect(ownerFirstName('Nawaf Nemrod SALAMI')).toBe('Nawaf')
    expect(ownerFirstName('  Nawaf ')).toBe('Nawaf')
    expect(ownerFirstName('')).toBe('Nawaf')
    expect(ownerFirstName(null)).toBe('Nawaf')
  })
})

describe('the pre-filled messages', () => {
  it('greet the owner, say what interests the visitor and leave a line to complete', () => {
    const m = whatsappMessage({ kind: 'offer', title: 'Boutique en ligne', price: '1 500 000 – 3 000 000 FCFA' }, 'fr', 'Nawaf')
    expect(m.startsWith('Bonjour Nawaf 👋')).toBe(true)
    expect(m).toContain('« Boutique en ligne »')
    expect(m).toContain('1 500 000 – 3 000 000 FCFA')
    expect(m).toContain('Mon projet en quelques mots :')
    expect(m.trimEnd().endsWith('Merci !')).toBe(true)
  })

  it('exist in English too', () => {
    const m = whatsappMessage({ kind: 'project', title: 'Chatbot' }, 'en', 'Nawaf')
    expect(m.startsWith('Hi Nawaf 👋')).toBe(true)
    expect(m).toContain('“Chatbot”')
    expect(m).toContain('My project in a few words:')
    expect(m.trimEnd().endsWith('Thank you!')).toBe(true)
  })

  it('tell the owner which page the visitor was on, when it is known', () => {
    const m = whatsappMessage({ kind: 'general' }, 'fr', 'Nawaf', 'https://example.test/fr/offres')
    expect(m).toContain('(https://example.test/fr/offres)')
    expect(whatsappMessage({ kind: 'general' }, 'fr', 'Nawaf')).not.toContain('(http')
  })

  it('cover every context', () => {
    const contexts = [
      { kind: 'general' }, { kind: 'offer', title: 'X' }, { kind: 'project', title: 'X' }, { kind: 'quote' },
      { kind: 'guide', title: 'X' }, { kind: 'finder', offer: 'X' }, { kind: 'chat' },
    ] as const
    for (const ctx of contexts) for (const locale of ['fr', 'en'] as const) {
      const m = whatsappMessage(ctx, locale, 'Nawaf')
      expect(m.length, `${ctx.kind}/${locale}`).toBeGreaterThan(40)
      expect(m.length).toBeLessThan(700)
    }
  })

  it('keep long titles and questions short, so the link stays usable', () => {
    const long = 'x'.repeat(500)
    const offer = whatsappMessage({ kind: 'offer', title: long, price: long }, 'fr', 'Nawaf')
    expect(offer.length).toBeLessThan(500)
    const chat = whatsappMessage({ kind: 'chat', question: long }, 'fr', 'Nawaf')
    expect(chat.length).toBeLessThan(500)
    expect(chat).toContain('…')
  })

  it('carry the visitor\'s own question from the chat, without asking for the project again', () => {
    const m = whatsappMessage({ kind: 'chat', question: 'Quel est le délai pour un site vitrine ?' }, 'fr', 'Nawaf')
    expect(m).toContain('« Quel est le délai pour un site vitrine ? »')
    expect(m).not.toContain('Mon projet en quelques mots')
  })

  it('never carry an access code, a quote number or an e-mail address', () => {
    const all = (['general', 'quote'] as const).map((kind) => whatsappMessage({ kind }, 'fr', 'Nawaf')).join('\n')
    expect(all).not.toMatch(/@|DEV-|code d.accès/i)
  })
})

describe('the WhatsApp button', () => {
  const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el)

  it('opens the link in a new tab, safely, with its icon and label', () => {
    const out = html(h(WhatsAppButton, { href: 'https://wa.me/24107123456?text=Bonjour', label: 'Écrire sur WhatsApp' }))
    expect(out).toContain('href="https://wa.me/24107123456?text=Bonjour"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('Écrire sur WhatsApp')
    expect(out).toContain('<svg')
  })

  it('shows nothing without a link: a page never offers a dead button', () => {
    expect(html(h(WhatsAppButton, { href: '', label: 'x' }))).toBe('')
  })
})

describe('the texts around the buttons', () => {
  it('exist in French and in English', () => {
    for (const locale of ['fr', 'en'] as const) {
      const w = getDictionary(locale).whatsapp
      for (const key of ['offerCta', 'projectTitle', 'projectCta', 'quoteHint', 'quoteCta', 'contactLabel', 'contactValue', 'guideHint', 'guideCta'] as const) {
        expect(w[key], `${locale}.${key}`).toBeTruthy()
      }
    }
    expect(getDictionary('fr').whatsapp.offerCta).not.toBe(getDictionary('en').whatsapp.offerCta)
  })
})

describe('one place builds WhatsApp links', () => {
  const ROOT = join(__dirname, '..', 'src')
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))

  it('does not rebuild a wa.me link by hand anywhere else (sharing a page is a different thing)', () => {
    const offenders = walk(ROOT)
      .filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith('lib\\whatsapp.ts') && !p.endsWith('lib/whatsapp.ts') && !p.includes('ShareButton'))
      .filter((p) => /wa\.me\/\$\{|wa\.me\/\$\{/.test(readFileSync(p, 'utf8')))
      .map((p) => p.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })

  it('is used by the footer, the assistant, the chat hand-off, the offers, the projects, the quote and the contact pages', () => {
    const uses = (p: string) => readFileSync(join(ROOT, p), 'utf8')
    for (const p of [
      'components/layout/Footer.tsx', 'app/api/chat/route.ts', 'components/chat/ChatPanels.tsx', 'app/[locale]/offres/OffersView.tsx',
      'app/[locale]/projects/[slug]/page.tsx', 'app/[locale]/devis/page.tsx', 'app/[locale]/contact/page.tsx',
    ]) expect(uses(p), p).toMatch(/lib\/whatsapp/)
  })
})
