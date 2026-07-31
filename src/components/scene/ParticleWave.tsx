'use client'
/* eslint-disable react-hooks/refs */

import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

// Halved vs. the original 60x40 grid — a background particle field reads the
// same at a glance, but recomputing every point's position via sin/cos every
// frame (x2 meshes) was a real, continuous CPU cost worth cutting.
const COLS = 38
const ROWS = 24
const SPACING = 0.32
const TARGET_FPS = 30

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches) // eslint-disable-line react-hooks/set-state-in-effect
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// The canvas is transparent over the page background, so its particle color
// must invert with the theme (light dots on dark bg, dark dots on light bg)
// or it disappears. Always mounted client-only (dynamic ssr:false), so
// reading the DOM directly on first render is accurate — no flash.
function useIsDarkTheme() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )
  useEffect(() => {
    const el = document.documentElement
    const observer = new MutationObserver(() => setIsDark(el.classList.contains('dark')))
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

// `frameloop="demand"` on the Canvas means nothing renders unless this
// explicitly asks for a frame. Without it R3F redraws (and re-uploads GPU
// buffers) at the display's full refresh rate — up to 120-144Hz — for a
// slow-drifting background, and every redraw forces the glass cards on top
// of it to re-run their backdrop-filter blur. Capping the actual render
// cadence, not just our own math, is what cuts that cost.
function FrameLimiter({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!active) return
    const id = setInterval(invalidate, 1000 / TARGET_FPS)
    return () => clearInterval(id)
  }, [invalidate, active])
  return null
}

function Wave({ reduceMotion, isDark }: { reduceMotion: boolean; isDark: boolean }) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const count = COLS * ROWS
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        const idx = (i * ROWS + j) * 3
        positions[idx]     = (i - COLS / 2) * SPACING
        positions[idx + 1] = 0
        positions[idx + 2] = (j - ROWS / 2) * SPACING
      }
    }
    return positions
  }, [])

  const posRef = useRef(positions.slice())

  useFrame(({ clock }) => {
    if (reduceMotion) return
    const t = clock.getElapsedTime()
    const arr = posRef.current
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        const idx = (i * ROWS + j) * 3
        const x = (i - COLS / 2) * SPACING
        const z = (j - ROWS / 2) * SPACING
        arr[idx + 1] =
          Math.sin(x * 0.8 + t * 0.9) * 0.55 +
          Math.cos(z * 0.6 + t * 0.7) * 0.35 +
          Math.sin((x + z) * 0.4 + t * 0.5) * 0.25
      }
    }
    if (ref.current) {
      ;(ref.current.geometry.attributes.position as THREE.BufferAttribute).array = arr
      ref.current.geometry.attributes.position.needsUpdate = true
      ref.current.rotation.y = t * 0.04
    }
  })

  return (
    <Points ref={ref} positions={posRef.current} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={isDark ? '#FFFFFF' : '#111111'}
        size={0.045}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  )
}

function SecondaryWave({ reduceMotion, isDark }: { reduceMotion: boolean; isDark: boolean }) {
  const ref = useRef<THREE.Points>(null)

  const { positions } = useMemo(() => {
    const count = COLS * ROWS
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        const idx = (i * ROWS + j) * 3
        positions[idx]     = (i - COLS / 2) * SPACING
        positions[idx + 1] = 0
        positions[idx + 2] = (j - ROWS / 2) * SPACING
      }
    }
    return { positions }
  }, [])

  const posRef = useRef(positions.slice())

  useFrame(({ clock }) => {
    if (reduceMotion) return
    const t = clock.getElapsedTime() + 1.5
    const arr = posRef.current
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        const idx = (i * ROWS + j) * 3
        const x = (i - COLS / 2) * SPACING
        const z = (j - ROWS / 2) * SPACING
        arr[idx + 1] =
          Math.cos(x * 0.7 + t * 0.8) * 0.4 +
          Math.sin(z * 0.5 + t * 0.6) * 0.3
      }
    }
    if (ref.current) {
      ;(ref.current.geometry.attributes.position as THREE.BufferAttribute).array = arr
      ref.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <Points ref={ref} positions={posRef.current} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={isDark ? '#D4D4D4' : '#4B5563'}
        size={0.025}
        sizeAttenuation
        depthWrite={false}
        opacity={0.35}
      />
    </Points>
  )
}

export default function ParticleWave() {
  const reduceMotion = usePrefersReducedMotion()
  const isDark = useIsDarkTheme()

  return (
    <div
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 5.5, 7], fov: 60 }}
        gl={{ alpha: true, antialias: false }}
        style={{ background: 'transparent' }}
        dpr={[1, 1.5]}
        frameloop="demand"
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[0, 8, 0]} intensity={1.2} color="#FFFFFF" />
        <pointLight position={[-6, 2, 4]} intensity={0.6} color="#C7C7C7" />

        <FrameLimiter active={!reduceMotion} />
        <Wave reduceMotion={reduceMotion} isDark={isDark} />
        <SecondaryWave reduceMotion={reduceMotion} isDark={isDark} />
      </Canvas>
    </div>
  )
}
