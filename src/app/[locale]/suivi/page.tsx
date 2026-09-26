import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import SuiviView from './SuiviView'

// A lookup tool keyed on a private code: useful to a client, worthless in a
// search index.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const t = getDictionary(isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE)
  return { title: t.track.title, description: t.track.subtitle, robots: { index: false, follow: true } }
}

export default function SuiviPage() {
  return <SuiviView />
}
