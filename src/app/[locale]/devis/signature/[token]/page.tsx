import type { Metadata } from 'next'
import SignatureView from './SignatureView'

// A private, per-client link — never indexed, never listed anywhere public.
export const metadata: Metadata = {
  title: 'Signature du devis',
  robots: { index: false, follow: false },
}

export default async function SignaturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SignatureView token={token} />
}
