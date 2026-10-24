import Link from 'next/link'
import Icon, { iconForCommitment } from '@/components/ui/Icon'
import type { GuideBlock, GuideSection } from '@/data/guides'
import type { Offer } from '@/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { ResolvedBusiness } from '@/lib/business'
import type { Locale } from '@/lib/i18n/locale'

const muted = { color: 'var(--text-muted)' } as const

// The offer that is about payment, if the owner has one: the guide on payments points to it.
export const paymentOffer = (offers: Offer[]): Offer | undefined => offers.find((o) => /paiement|payment/i.test(o.title))

// The body of a guide: its sections, with the blocks that are plain text written in the guide, and
// the blocks that are facts about the owner's business (prices, terms, payment) read from the
// site's real data, passed in by the page. Server component: no JavaScript is sent for it.
export default function GuideBody({ sections, offers, business, t, work, locale }: {
  sections: GuideSection[]
  offers: Offer[]
  business: ResolvedBusiness
  t: Dictionary['guides']
  work: Dictionary['work']
  locale: Locale
}) {
  const priced = offers.filter((o) => o.priceLabel?.trim())

  const block = (b: GuideBlock, i: number) => {
    switch (b.kind) {
      case 'p':
        return <p key={i} className="text-base leading-relaxed mb-4" style={muted}>{b.text}</p>
      case 'ul':
        return (
          <ul key={i} className="space-y-2.5 mb-5">
            {b.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-base leading-relaxed" style={muted}>
                <Icon name="chevronRight" size={16} className="flex-shrink-0 mt-1" style={{ color: 'var(--brand, var(--accent))' }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )
      case 'note':
        return (
          <p key={i} className="text-sm leading-relaxed mb-4 pl-4 py-1" style={{ ...muted, borderLeft: '3px solid var(--brand, var(--accent))' }}>{b.text}</p>
        )
      case 'prices':
        return priced.length === 0 ? (
          <p key={i} className="text-sm mb-4" style={muted}>{t.noPrices}</p>
        ) : (
          <div key={i} className="mb-5 overflow-x-auto" data-testid="guide-prices">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th scope="col" className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--text)' }}>{t.offerHead}</th>
                  <th scope="col" className="text-left py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--text)' }}>{t.priceHead}</th>
                </tr>
              </thead>
              <tbody>
                {priced.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--text)' }}>{o.title}</td>
                    <td className="py-2.5 whitespace-nowrap font-medium" style={{ color: 'var(--accent)' }}>{o.priceLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'terms':
        return (
          <dl key={i} className="grid sm:grid-cols-2 gap-3 mb-5" data-testid="guide-terms">
            {work.commitments(business).map((c) => (
              <div key={c.label} className="card p-4 flex items-start gap-3">
                <Icon name={iconForCommitment(c.label)} size={26} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--brand, var(--accent))' }} />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>{c.label}</dt>
                  <dd className="font-display font-bold text-xl" style={{ color: 'var(--accent)' }}>{c.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        )
      case 'payment': {
        const offer = paymentOffer(offers)
        return (
          <div key={i} className="mb-5 space-y-3" data-testid="guide-payment">
            {offer ? (
              <div className="card p-5">
                <p className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--text)' }}>{offer.title}</p>
                <p className="text-sm leading-relaxed mb-2" style={muted}>{offer.description}</p>
                {offer.priceLabel && <p className="font-display font-bold" style={{ color: 'var(--accent)' }}>{offer.priceLabel}</p>}
              </div>
            ) : (
              <p className="text-sm" style={muted}>{t.paymentNone}</p>
            )}
            {business.paymentMethods && (
              <p className="text-sm" style={muted}>
                <strong style={{ color: 'var(--text)' }}>{t.paymentMethods} : </strong>{business.paymentMethods}
              </p>
            )}
            <Link href={`/${locale}/offres`} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
              {t.seeOffers}<Icon name="arrowRight" size={14} />
            </Link>
          </div>
        )
      }
    }
  }

  return (
    <div>
      {sections.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="mb-12 scroll-mt-24">
          <h2 id={`${section.id}-title`} className="font-display font-bold mb-4" style={{ fontSize: 'clamp(1.35rem,3vw,1.75rem)', color: 'var(--text)' }}>{section.heading}</h2>
          {section.blocks.map(block)}
        </section>
      ))}
    </div>
  )
}
