'use client'

import dynamic from 'next/dynamic'

const StarsCanvas = dynamic(() => import('./StarsCanvas').then((m) => m.StarsCanvas), { ssr: false })

export default function StarsCanvasClient({ className }: { className?: string }) {
  return <StarsCanvas hue={260} className={className} />
}
