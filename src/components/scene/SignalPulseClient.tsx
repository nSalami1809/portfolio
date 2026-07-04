'use client'

import dynamic from 'next/dynamic'

const SignalPulse = dynamic(() => import('./SignalPulse'), { ssr: false })

export default function SignalPulseClient() {
  return <SignalPulse />
}
