import { translateFieldsBatch } from '@/lib/translate'
import { formatFcfa, previewLines, previewTotal, quotePreviewOffers } from '@/lib/quote-preview'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/locale'
import type { Offer } from '@/types'

/** Height of the sheet: reserved while the offers' titles are translated, so nothing moves when it arrives. */
export const QUOTE_PREVIEW_HEIGHT = 440

export function QuotePreviewSkeleton() {
  return <div aria-hidden="true" className="animate-pulse w-full" style={{ height: QUOTE_PREVIEW_HEIGHT, background: 'var(--surface)', border: '1px solid var(--border)' }} />
}

// The sheet is drawn like the real quote PDF (white paper, black ink, a title, the provider and the client, a table of
// services, the totals), so it reads as the object the "instant quote" button produces. Fixed paper colours, on purpose:
// a sheet of paper stays white in the dark theme. Contrast of the grey: 6 to 1 on white.
const INK = '#111111'
const MUTED = '#5f6368'
const RULE = '#d9d9d9'

/**
 * What the "instant quote" button produces, shown as an EXAMPLE: a quote laid out like the real document, with the
 * site's own offers and their real starting prices. It names no client ("Your company"), carries a visible "Example"
 * mark and a watermark, and says what the figures are.
 */
export default async function QuotePreview({ offers, locale, t, provider }: { offers: Offer[]; locale: Locale; t: Dictionary['home']; provider: { name: string; role: string } }) {
  const picked = quotePreviewOffers(offers)
  if (picked.length < 2) return null

  // Same fields (so the same cache) as the Offers page: no new translation for an offer already read in English
  const fields = await translateFieldsBatch(
    locale,
    picked.map((o) => ({ key: `offer:${o.id}`, fields: { title: o.title, description: o.description, features: (o.features ?? []).join('\n') } })),
  )
  const lines = previewLines(picked, Object.fromEntries(picked.map((o, i) => [o.id, fields[i].title])))
  const total = previewTotal(lines)
  const label = { fontFamily: 'var(--font-poppins)', color: MUTED }
  const cell = { fontFamily: 'var(--font-poppins)', fontVariantNumeric: 'tabular-nums' as const }

  return (
    <figure
      aria-label={t.quotePreviewAria}
      className="relative m-0 w-full flex flex-col overflow-hidden"
      style={{ minHeight: QUOTE_PREVIEW_HEIGHT, background: '#ffffff', color: INK, border: `1px solid ${RULE}`, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
    >
      {/* Watermark, like the sample documents */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center font-display font-semibold"
        style={{ fontSize: '4.5rem', letterSpacing: '0.08em', color: 'rgba(0,0,0,0.05)', transform: 'rotate(-18deg)' }}
      >
        {t.quotePreviewExample.toUpperCase()}
      </span>

      <div className="relative flex items-start justify-between gap-4 p-5" style={{ borderBottom: `1px solid ${RULE}` }}>
        <div>
          <p className="font-display text-xl font-semibold m-0" style={{ color: INK, letterSpacing: '0.04em' }}>{t.quotePreviewTitle.toUpperCase()}</p>
          <p className="text-xs m-0 mt-1" style={label}>{t.quotePreviewRef}</p>
        </div>
        <span className="text-xs font-medium px-2 py-1 flex-shrink-0" style={{ border: `1px solid ${MUTED}`, color: MUTED, fontFamily: 'var(--font-poppins)' }}>
          {t.quotePreviewExample}
        </span>
      </div>

      <div className="relative grid grid-cols-2 gap-4 px-5 py-4 text-xs" style={{ borderBottom: `1px solid ${RULE}`, fontFamily: 'var(--font-poppins)' }}>
        <div>
          <p className="m-0 mb-1 font-medium" style={{ color: MUTED }}>{t.quotePreviewProvider}</p>
          <p className="m-0 font-semibold" style={{ color: INK }}>{provider.name}</p>
          <p className="m-0" style={{ color: MUTED }}>{provider.role}</p>
        </div>
        <div>
          <p className="m-0 mb-1 font-medium" style={{ color: MUTED }}>{t.quotePreviewClient}</p>
          <p className="m-0 font-semibold" style={{ color: INK }}>{t.quotePreviewClientValue}</p>
        </div>
      </div>

      <table className="relative w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <caption className="sr-only">{t.quotePreviewAria}</caption>
        <thead>
          <tr className="text-xs">
            <th scope="col" className="text-left font-medium px-5 pt-4 pb-2" style={label}>{t.quotePreviewLines}</th>
            <th scope="col" className="text-right font-medium px-2 pt-4 pb-2" style={label}>{t.quotePreviewQty}</th>
            <th scope="col" className="text-right font-medium px-5 pt-4 pb-2" style={label}>{t.quotePreviewFrom}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} style={{ borderTop: `1px solid ${RULE}` }}>
              <td className="px-5 py-3" style={{ ...cell, color: INK }}>{line.title}</td>
              <td className="px-2 py-3 text-right" style={{ ...cell, color: MUTED }}>1</td>
              <td className="px-5 py-3 text-right whitespace-nowrap" style={{ ...cell, color: INK }}>{formatFcfa(line.amount, locale)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `1px solid ${INK}` }}>
            <th scope="row" colSpan={2} className="text-left font-semibold px-5 py-3" style={{ ...cell, color: INK }}>{t.quotePreviewTotal}</th>
            <td className="px-5 py-3 text-right font-semibold whitespace-nowrap" style={{ ...cell, color: INK }}>{formatFcfa(total, locale)}</td>
          </tr>
        </tfoot>
      </table>

      <figcaption className="relative mt-auto px-5 pb-4 text-xs" style={label}>
        {t.quotePreviewNote}
      </figcaption>
    </figure>
  )
}
