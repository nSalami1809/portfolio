import type { Metadata } from 'next'
import RecetteView from './RecetteView'

// A private, per-client link — never indexed, never listed anywhere public.
export const metadata: Metadata = {
  title: 'Procès-verbal de recette',
  robots: { index: false, follow: false },
}

export default async function RecettePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <RecetteView token={token} />
}
