'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// three.js + react-three-fiber are by far the heaviest code on the public site and this canvas is purely
// decorative, so it must never compete with the page itself:
//  - it starts only once the browser is idle after the page is shown (never during hydration or the first paint);
//  - on a phone (narrow screen) or with the browser's data saver on, it is not loaded at all, so those visitors
//    do not download the 3D engine for a background they would hardly notice.
// The dynamic import below is only evaluated when this renders, so the 3D chunk is fetched only when it is wanted.
const ParticleWave = dynamic(() => import('./ParticleWave'), { ssr: false })

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } }

export function sceneAllowed(win: Pick<Window, 'matchMedia' | 'navigator'>): boolean {
  if (!win.matchMedia('(min-width: 768px)').matches) return false
  return !(win.navigator as NavigatorWithConnection).connection?.saveData
}

export default function ParticleWaveClient() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!sceneAllowed(window)) return
    const start = () => setReady(true)
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(start, 1200)
    return () => window.clearTimeout(id)
  }, [])

  return ready ? <ParticleWave /> : null
}
