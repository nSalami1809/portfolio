'use client'

import { useEffect, useRef, useState } from 'react'
import SignaturePadLib from 'signature_pad'

interface Props {
  onChange: (dataUrl: string | null) => void
  height?: number
  disabled?: boolean
}

// Freehand signature capture — mouse, trackpad and touch all go through the
// same pointer-event pipeline in signature_pad, so no separate handling is
// needed per input device. Kept as a dumb, controlled-via-callback component
// so both the provider's settings page and the public client signing page
// can reuse it without sharing any other state.
export default function SignaturePad({ onChange, height = 180, disabled = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // Size the backing buffer for the device's pixel ratio once, at mount —
    // resizing later would force clearing the canvas, which would wipe out
    // an in-progress signature on e.g. a mobile keyboard-triggered reflow.
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = height * ratio

    const pad = new SignaturePadLib(canvas, { backgroundColor: 'rgba(0,0,0,0)', penColor: '#111111' })
    padRef.current = pad
    canvas.getContext('2d')?.scale(ratio, ratio)

    const handleEnd = () => {
      const isEmpty = pad.isEmpty()
      setEmpty(isEmpty)
      onChange(isEmpty ? null : pad.toDataURL('image/png'))
    }
    pad.addEventListener('endStroke', handleEnd)

    return () => {
      pad.removeEventListener('endStroke', handleEnd)
      pad.off()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time setup, see comment above
  }, [])

  useEffect(() => {
    if (disabled) padRef.current?.off()
    else padRef.current?.on()
  }, [disabled])

  const handleClear = () => {
    padRef.current?.clear()
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{ border: '1px solid var(--border)', background: '#ffffff', touchAction: 'none', opacity: disabled ? 0.6 : 1 }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height, display: 'block', cursor: disabled ? 'default' : 'crosshair' }}
        />
      </div>
      <div className="flex items-center justify-between mt-2 gap-3">
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          Dessinez avec la souris, le doigt ou le trackpad.
        </p>
        <button
          type="button"
          onClick={handleClear}
          disabled={empty || disabled}
          className="btn-secondary btn-xs flex-shrink-0"
        >
          Effacer
        </button>
      </div>
    </div>
  )
}
