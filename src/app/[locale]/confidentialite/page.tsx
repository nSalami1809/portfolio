import type { Metadata } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'
import { defaultPersonalInfo } from '@/data/defaultData'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'

export const metadata: Metadata = { robots: { index: false, follow: true } }

function content(locale: 'fr' | 'en', email: string) {
  if (locale === 'en') {
    return {
      title: 'Privacy policy',
      sections: [
        {
          h: 'What data is collected',
          b: 'Name, email, phone (optional) and message content when you use the contact form, the quote request flow, or book an appointment on the calendar. Nothing else is asked for, and none of these fields are required beyond what each form itself asks.',
        },
        {
          h: 'Why it\'s collected',
          b: `Solely to respond to your request — a project quote, a scheduled call, or a reply to your message. Your email may also be used to send you a copy of a quote or a booking confirmation you explicitly requested.`,
        },
        {
          h: 'Where it\'s stored',
          b: 'In a MongoDB Atlas database, accessible only by the site owner. It is never sold, rented, or shared with third parties for marketing purposes.',
        },
        {
          h: 'Analytics',
          b: 'This site uses Vercel Analytics (privacy-friendly, no cookies) and a minimal internal page-view counter (no cookies, no IP address stored, no unique-visitor tracking) purely to understand overall traffic. Neither identifies individual visitors.',
        },
        {
          h: 'Cookies',
          b: 'This site does not use tracking or advertising cookies. A local browser preference (light/dark theme) is stored on your device only, never sent to a server.',
        },
        {
          h: 'Your rights',
          b: `You can request access to, correction of, or deletion of any data you've submitted at any time by writing to ${email}.`,
        },
        {
          h: 'Retention',
          b: 'Contact messages, quotes, and bookings are kept as long as needed for follow-up, and can be deleted on request at any time.',
        },
      ],
    }
  }
  return {
    title: 'Politique de confidentialité',
    sections: [
      {
        h: 'Quelles données sont collectées',
        b: 'Nom, email, téléphone (optionnel) et contenu du message lorsque vous utilisez le formulaire de contact, la demande de devis, ou la prise de rendez-vous sur le calendrier. Rien d\'autre n\'est demandé, et aucun champ n\'est exigé au-delà de ce que chaque formulaire demande explicitement.',
      },
      {
        h: 'Pourquoi ces données sont collectées',
        b: `Uniquement pour répondre à votre demande — un devis de projet, un appel programmé, ou une réponse à votre message. Votre email peut aussi être utilisé pour vous envoyer une copie d'un devis ou une confirmation de rendez-vous que vous avez explicitement demandée.`,
      },
      {
        h: 'Où ces données sont stockées',
        b: 'Dans une base de données MongoDB Atlas, accessible uniquement par l\'éditeur du site. Elles ne sont jamais vendues, louées, ni partagées avec des tiers à des fins commerciales.',
      },
      {
        h: 'Mesure d\'audience',
        b: 'Ce site utilise Vercel Analytics (respectueux de la vie privée, sans cookie) et un compteur de vues interne minimal (sans cookie, sans stockage d\'adresse IP, sans suivi de visiteur unique) uniquement pour comprendre le trafic global. Aucun des deux n\'identifie les visiteurs individuellement.',
      },
      {
        h: 'Cookies',
        b: 'Ce site n\'utilise aucun cookie de suivi ou publicitaire. Une préférence locale (thème clair/sombre) est enregistrée sur votre appareil uniquement, jamais transmise à un serveur.',
      },
      {
        h: 'Vos droits',
        b: `Vous pouvez demander l'accès, la correction ou la suppression de toute donnée que vous avez transmise, à tout moment, en écrivant à ${email}.`,
      },
      {
        h: 'Durée de conservation',
        b: 'Les messages de contact, devis et rendez-vous sont conservés le temps nécessaire au suivi, et peuvent être supprimés sur simple demande à tout moment.',
      },
    ],
  }
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const portfolio = await fetchPortfolio().catch(() => null)
  const personal = portfolio?.personal ?? defaultPersonalInfo

  const { title, sections } = content(locale === 'en' ? 'en' : 'fr', personal.email)

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
