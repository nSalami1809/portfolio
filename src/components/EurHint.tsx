'use client'

import { useLocale } from '@/lib/i18n/useLocale'
import { eurApprox, eurFromLabel } from '@/lib/currency'

interface Props {
  // Either the price text as displayed ("600 000 – 1 000 000 FCFA")…
  label?: string
  // …or the amount(s) in FCFA.
  fcfa?: number
  fcfaMax?: number
  className?: string
}

// Approximate euro equivalent next to a price in FCFA — English pages only.
export default function EurHint({ label, fcfa, fcfaMax, className }: Props) {
  const locale = useLocale()
  if (locale !== 'en') return null
  const text = label !== undefined ? eurFromLabel(label) : fcfa && fcfa > 0 ? eurApprox(fcfa, fcfaMax) : null
  if (!text) return null
  return <span className={className} style={{ opacity: 0.75, fontWeight: 400 }} title="Indicative amount at the fixed CFA franc / euro parity — invoiced in FCFA"> {text}</span>
}
