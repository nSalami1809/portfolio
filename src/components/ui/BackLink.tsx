import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { Locale } from '@/lib/i18n/locale'

/** "Back to home" button at the top of the legal pages. */
export default function BackLink({ locale }: { locale: Locale }) {
  return (
    <Link href={`/${locale}`} className="btn-secondary mb-8 inline-flex">
      <Icon name="arrowLeft" size={14} />
      {locale === 'en' ? 'Back to home' : "Retour à l'accueil"}
    </Link>
  )
}
