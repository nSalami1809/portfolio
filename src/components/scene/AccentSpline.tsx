'use client'

import { useEffect, useRef, useState } from 'react'
import { Application } from '@splinetool/runtime'

const SCENE = 'https://prod.spline.design/XiO3qB0Jc1fGmZO7/scene.splinecode'

export default function AccentSpline({ height = 420 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let app: Application | null = null
    let cancelled = false

    // Suppress non-fatal runtime errors from scene event/state data
    const origError = console.error
    const origWarn  = console.warn
    const suppress  = (msg: unknown) =>
      typeof msg === 'string'
        ? msg.includes('Missing property') || msg.includes('position')
        : msg instanceof Error &&
          (msg.message.includes('Missing property') || msg.message.includes('position'))
    console.error = (...a: unknown[]) => { if (!suppress(a[0])) origError(...a) }
    console.warn  = (...a: unknown[]) => { if (!suppress(a[0])) origWarn(...a) }

    ;(async () => {
      try {
        app = new Application(canvas, { renderMode: 'auto' })
        await app.load(SCENE)
        if (cancelled) return

        // Remove "Built with Spline" watermark
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(app as any)._renderer?.pipeline?.setWatermark(null)
        } catch { /* non-critical */ }

        setLoaded(true)
      } catch (err) {
        // Only log unexpected errors, not known scene data issues
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.includes('position') && !msg.includes('Missing property')) {
          origError('[AccentSpline]', err)
        }
      } finally {
        console.error = origError
        console.warn  = origWarn
      }
    })()

    return () => {
      cancelled = true
      app?.dispose()
    }
  }, [])

  return (
    <div className="relative w-full" style={{ height }} aria-hidden="true">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
          />
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.6s ease',
          mixBlendMode: 'screen',
        }}
      />
    </div>
  )
}
