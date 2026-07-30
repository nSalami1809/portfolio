'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

type Mode = 'default' | 'label' | 'code' | 'robot'

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<Mode>('default')
  const [label, setLabel] = useState('')

  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  const trailX = useSpring(cursorX, { damping: 28, stiffness: 220, mass: 0.5 })
  const trailY = useSpring(cursorY, { damping: 28, stiffness: 220, mass: 0.5 })

  // Only for desktops with a real pointer — touch devices have no hover/cursor concept,
  // and skipping this entirely there avoids adding any listeners/work on mobile.
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine) and (hover: hover)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (fine && !reduced) setEnabled(true) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  useEffect(() => {
    if (!enabled) return

    document.documentElement.classList.add('custom-cursor-active')

    const move = (e: PointerEvent) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
    }

    const over = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return
      const matched = target.closest('[data-cursor], [data-cursor-label], code, pre, button, a')
      if (!matched) { setMode('default'); return }
      if (matched.matches('code, pre')) { setMode('code'); return }
      const explicit = matched.getAttribute('data-cursor')
      if (explicit === 'robot') { setMode('robot'); return }
      const text = matched.getAttribute('data-cursor-label')
      if (text) { setMode('label'); setLabel(text); return }
      if (matched.tagName === 'BUTTON') { setMode('label'); setLabel('Cliquer'); return }
      setMode('label'); setLabel('Voir')
    }

    const show = () => setVisible(true)
    const hide = () => setVisible(false)

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerover', over, { passive: true })
    document.documentElement.addEventListener('mouseenter', show)
    document.documentElement.addEventListener('mouseleave', hide)

    return () => {
      document.documentElement.classList.remove('custom-cursor-active')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerover', over)
      document.documentElement.removeEventListener('mouseenter', show)
      document.documentElement.removeEventListener('mouseleave', hide)
    }
  }, [enabled, cursorX, cursorY])

  if (!enabled) return null

  const size =
    mode === 'label' ? { width: Math.max(64, label.length * 8 + 24), height: 34, borderRadius: 17 } :
    mode === 'code'  ? { width: 34, height: 34, borderRadius: 10 } :
    mode === 'robot' ? { width: 34, height: 34, borderRadius: 9999 } :
                        { width: 10, height: 10, borderRadius: 9999 }

  return (
    <>
      {/* trailing glow */}
      <motion.div
        aria-hidden="true"
        style={{ position: 'fixed', left: 0, top: 0, x: trailX, y: trailY, zIndex: 9998, pointerEvents: 'none' }}
        animate={{ opacity: visible ? 0.5 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <div
          style={{
            width: 34, height: 34, borderRadius: 9999,
            transform: 'translate(-50%, -50%)',
            background: 'var(--accent)', opacity: 0.18, filter: 'blur(3px)',
          }}
        />
      </motion.div>

      {/* main cursor */}
      <motion.div
        aria-hidden="true"
        style={{ position: 'fixed', left: 0, top: 0, x: cursorX, y: cursorY, zIndex: 9999, pointerEvents: 'none' }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          animate={size}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          style={{
            position: 'relative',
            transform: 'translate(-50%, -50%)',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px var(--accent-glow)',
          }}
        >
          {mode === 'default' && (
            <span className="cursor-orbit-wrap">
              <span className="cursor-orbit-ring" />
            </span>
          )}
          {mode === 'label' && (
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-poppins)' }}>
              {label}
            </span>
          )}
          {mode === 'code' && (
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{'</>'}</span>
          )}
          {mode === 'robot' && <span style={{ fontSize: 16, lineHeight: 1 }}>🤖</span>}
        </motion.div>
      </motion.div>
    </>
  )
}
