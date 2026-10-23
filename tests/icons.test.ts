import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Icon, { ICON_NAMES, iconForText } from '@/components/ui/Icon'

const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el)

describe('the site\'s icons', () => {
  it('draws every named icon as a decorative SVG, in the colour of its text', () => {
    expect(ICON_NAMES.length).toBeGreaterThan(100)
    for (const name of ICON_NAMES) {
      const out = html(h(Icon, { name, size: 20 }))
      expect(out, name).toMatch(/^<svg /)
      expect(out, name).toContain('aria-hidden="true"')
      expect(out, name).toContain('stroke="currentColor"')
      expect(out, name).toContain('width="20"')
    }
  })

  it('keeps the line weight readable: heavier when small, finer when large', () => {
    const weight = (size: number) => Number(/stroke-width="([\d.]+)"/.exec(html(h(Icon, { name: 'mail', size })))?.[1])
    expect(weight(14)).toBeGreaterThan(weight(30))
    expect(html(h(Icon, { name: 'mail', size: 30, strokeWidth: 1 }))).toContain('stroke-width="1"')
  })

  it('passes a class and a style on, for layout and colour', () => {
    const out = html(h(Icon, { name: 'check', className: 'mt-0.5', style: { color: 'var(--brand, var(--accent))' } }))
    expect(out).toContain('class="mt-0.5"')
    expect(out).toContain('color:var(--brand, var(--accent))')
  })
})

describe('which icon says what, from its own words', () => {
  it.each([
    ['Boutique en ligne Catalogue produits', 'store'],
    ['Intégration paiement en ligne', 'card'],
    ['Authentification & gestion des utilisateurs', 'lock'],
    ['Support multilingue', 'language'],
    ['Mise en place hébergement / CI-CD', 'cloud'],
    ['Maintenance mensuelle', 'wrench'],
    ['Formation / prise en main', 'graduation'],
    ['Site vitrine simple', 'webDesign'],
    ['Application web sur mesure', 'layout'],
  ])('an offer "%s" gets "%s"', (text, name) => {
    expect(iconForText(text)).toBe(name)
  })

  it.each([
    ['Frontend', 'layout'],
    ['Backend', 'server'],
    ['DevOps & Cloud', 'cloud'],
    ['Outils', 'devTools'],
  ])('a skills category "%s" gets "%s"', (text, name) => {
    expect(iconForText(text, 'cpu')).toBe(name)
  })

  it.each([
    ['Brief et devis instantané', 'invoice'],
    ['Signature en ligne', 'signature'],
    ['Signature et acompte', 'signature'],
    ['Acompte et démarrage', 'wallet'],
    ['Développement et révisions', 'code'],
    ['Livraison et recette', 'delivery'],
    ['Livraison, recette, garantie', 'delivery'],
    ['Solde, reçu et garantie', 'shield'],
  ])('a project step "%s" gets "%s", so no two neighbouring steps share an icon', (text, name) => {
    expect(iconForText(text)).toBe(name)
  })

  it('falls back on what it is given when the words say nothing', () => {
    expect(iconForText('???', 'heart')).toBe('heart')
    expect(iconForText('???')).toBe('layers')
  })
})

describe('no hand-drawn icon is left on the public pages', () => {
  const ROOT = join(__dirname, '..', 'src')
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
  const files = walk(ROOT).filter((p) => p.endsWith('.tsx'))

  // Drawings that are not icons of the set on purpose: ratings, play/pause, plus/minus, charts, device frames, the PDF viewer.
  const KEPT = ['StarRating', 'StarRatingInput', 'Disclosure', 'DeviceFrames', 'ProjectGallery', 'ProjectLightbox', 'ProjectMedia', 'ViewsLineChart', 'GalleryEditor', 'BotIcon', 'OffersView', 'CodePlayground', 'ShareButton', 'BlogPostView', 'PdfPreview', 'MonthGrid']

  it('draws the arrows, checks, mail, share, search and menu icons through <Icon />', () => {
    const feather = [/M5 12h14M12 5l7 7-7 7/, /points="20 6 9 17 4 12"/, /M19 12H5M12 19l-7-7 7-7/, /M4 4h16c1\.1 0 2 \.9 2 2v12/, /circle cx="11" cy="11" r="8"/]
    for (const path of files) {
      if (KEPT.some((k) => path.includes(k))) continue
      const source = readFileSync(path, 'utf8')
      for (const re of feather) expect(source, `${path.slice(ROOT.length + 1)} still draws ${re}`).not.toMatch(re)
    }
  })

  it('has no inline SVG at all in the main navigation, footer, hero, contact form and the back-office sidebar', () => {
    for (const p of ['components/layout/Navbar.tsx', 'components/layout/Footer.tsx', 'components/sections/HeroSection.tsx', 'components/sections/ContactForm.tsx', 'app/admin/layout.tsx']) {
      expect(readFileSync(join(ROOT, p), 'utf8'), p).not.toContain('<svg')
    }
  })
})

describe('cards are flat: no shadow, no black frame', () => {
  const css = readFileSync(join(__dirname, '..', 'src', 'app', 'globals.css'), 'utf8')
  const rule = (selector: string) => new RegExp(`${selector.replace(/[.[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''

  it('has no shadow at rest or on hover, and lifts by 3 px on hover only for a real pointer', () => {
    expect(rule('.card')).toMatch(/box-shadow:\s*none/)
    const hover = /@media \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\) \{\s*\.card:hover \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(hover).toMatch(/translateY\(-3px\)/)
    expect(hover).not.toMatch(/box-shadow|border/)
  })

  it('draws no black frame around an open or hovered accordion, its tile or its badge', () => {
    expect(css).not.toMatch(/\.disclosure:hover\s*\{[^}]*border-color/)
    expect(css).not.toMatch(/\.disclosure\[data-open='true'\]\s*\{[^}]*border-color/)
    expect(rule('.disclosure-tile')).toMatch(/border:\s*1px solid var\(--border\)/)
    expect(rule('.disclosure-badge')).toMatch(/border:\s*1px solid var\(--border\)/)
  })

  it('keeps the corners square', () => {
    for (const token of ['--radius', '--radius-sm', '--radius-lg', '--radius-2xl']) expect(css).toMatch(new RegExp(`${token}:\\s*0px`))
  })
})
