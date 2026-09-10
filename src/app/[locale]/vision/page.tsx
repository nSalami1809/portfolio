import type { Metadata } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'
import { translateFields } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { defaultVision } from '@/data/defaultData'
import type { VisionData } from '@/types'
import VisionView from './VisionView'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  return { title: t.vision.title }
}

export default async function VisionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolio().catch(() => null)
  const vision = portfolio?.vision ?? defaultVision

  const fields: Record<string, string> = { quote: vision.quote }
  vision.philosophie.forEach((p, i) => { fields[`philosophie_${i}`] = p })
  vision.approche.forEach((p, i) => { fields[`approche_${i}`] = p })
  vision.valeurs.forEach((v, i) => {
    fields[`valeur_title_${i}`] = v.title
    fields[`valeur_text_${i}`] = v.text
  })
  const translated = await translateFields('vision', locale, fields)

  const translatedVision: VisionData = {
    quote: translated.quote ?? vision.quote,
    philosophie: vision.philosophie.map((p, i) => translated[`philosophie_${i}`] ?? p),
    approche: vision.approche.map((p, i) => translated[`approche_${i}`] ?? p),
    valeurs: vision.valeurs.map((v, i) => ({
      title: translated[`valeur_title_${i}`] ?? v.title,
      text: translated[`valeur_text_${i}`] ?? v.text,
    })),
  }

  return <VisionView vision={translatedVision} t={t.vision} />
}
