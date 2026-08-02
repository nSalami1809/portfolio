import type { Metadata } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'

export const metadata: Metadata = { robots: { index: false, follow: true } }

function content(locale: 'fr' | 'en', name: string, email: string, location: string) {
  if (locale === 'en') {
    return {
      title: 'Legal notice',
      sections: [
        { h: 'Site owner', b: `This site is published by ${name}, an independent freelance developer based in ${location}. Contact: ${email}.` },
        { h: 'Hosting', b: 'This site is hosted by Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA).' },
        { h: 'Data storage', b: 'Application data (portfolio content, quotes, messages, bookings) is stored with MongoDB Atlas.' },
        { h: 'Intellectual property', b: `All content on this site (text, visual identity, code) is the property of ${name} unless otherwise stated, and may not be reproduced without prior consent.` },
        { h: 'Liability', b: 'This site is provided "as is". While every effort is made to keep information accurate and up to date, no guarantee is given as to its completeness.' },
      ],
    }
  }
  return {
    title: 'Mentions légales',
    sections: [
      { h: 'Éditeur du site', b: `Ce site est édité par ${name}, développeur freelance indépendant basé à ${location}. Contact : ${email}.` },
      { h: 'Hébergement', b: 'Ce site est hébergé par Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA).' },
      { h: 'Stockage des données', b: 'Les données de l\'application (contenu du portfolio, devis, messages, rendez-vous) sont stockées via MongoDB Atlas.' },
      { h: 'Propriété intellectuelle', b: `L'ensemble du contenu de ce site (textes, identité visuelle, code) est la propriété de ${name}, sauf mention contraire, et ne peut être reproduit sans accord préalable.` },
      { h: 'Responsabilité', b: 'Ce site est fourni "en l\'état". Bien que les informations soient tenues à jour avec soin, aucune garantie n\'est donnée quant à leur exhaustivité.' },
    ],
  }
}

export default async function LegalNoticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const portfolio = await fetchPortfolio().catch(() => null)
  const personal = portfolio?.personal ?? defaultPersonalInfo

  const { title, sections } = content(locale === 'en' ? 'en' : 'fr', personal.name, personal.email, personal.location)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <h1 className="section-title mb-10" style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>{title}</h1>
      <div className="space-y-8">
        {sections.map((s) => (
          <div key={s.h}>
            <h2 className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>{s.h}</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.b}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
