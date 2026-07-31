'use client'

import { useParams } from 'next/navigation'
import { DEFAULT_LOCALE, isLocale, type Locale } from './locale'
import { getDictionary } from './dictionaries'

export function useLocale(): Locale {
  const params = useParams<{ locale?: string }>()
  const locale = params?.locale
  return locale && isLocale(locale) ? locale : DEFAULT_LOCALE
}

export function useDictionary() {
  return getDictionary(useLocale())
}
