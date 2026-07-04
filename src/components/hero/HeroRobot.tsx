'use client'

import { useEffect, useRef, useState } from 'react'
import { Application } from '@splinetool/runtime'

// API endpoint (Application class, watermark-removable)
const SPLINE_URL = 'https://prod.spline.design/nexbotrobotcharacterconceptcopy-MueYaqDQ4M0oAcwTAvC4TSEo/scene.splinecode'
// Iframe fallback (works even when CORS blocks the API endpoint)
const SPLINE_EMBED = 'https://my.spline.design/nexbotrobotcharacterconceptcopy-MueYaqDQ4M0oAcwTAvC4TSEo/'

const S = 0.82

type Mode = 'loading' | 'canvas' | 'iframe'

function Loader() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
      <div
        className="w-14 h-14 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
      />
      <p
        className="text-xs tracking-widest mt-4"
        style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}
      >
        CHARGEMENT...
      </p>
    </div>
  )
}

export default function HeroRobot() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>('loading')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let app: Application | null = null
    let cancelled = false

    ;(async () => {
      try {
        app = new Application(canvas, { renderMode: 'auto' })
        await app.load(SPLINE_URL)
        if (cancelled) return
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(app as any)._renderer?.pipeline?.setWatermark(null)
        } catch { /* non-critical */ }
        setMode('canvas')
      } catch {
        if (cancelled) return
        app?.dispose()
        app = null
        setMode('iframe')
      }
    })()

    return () => {
      cancelled = true
      app?.dispose()
    }
  }, [])

  if (mode === 'iframe') {
    return (
      <div
        className="relative w-full h-full"
        aria-hidden="true"
        style={{ overflow: 'hidden' }}
      >
        <iframe
          src={SPLINE_EMBED}
          title="Robot 3D"
          allow="autoplay"
          loading="lazy"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${100 / S}%`,
            height: `${100 / S}%`,
            border: 'none',
            background: 'transparent',
            transform: `scale(${S})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="relative w-full h-full"
      aria-hidden="true"
      style={{ contain: 'layout paint style' }}
    >
      {mode === 'loading' && <Loader />}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          opacity: mode === 'canvas' ? 1 : 0,
          transition: 'opacity 0.5s ease',
          display: 'block',
        }}
      />
    </div>
  )
}