'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT  = 1400
const RADIUS = 2.2
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

// See ParticleWave.tsx for why: `frameloop="demand"` + a throttled manual
// invalidate caps the actual render/compositing rate at ~30fps instead of
// the display's full refresh rate, which matters because this canvas sits
// behind glass cards whose backdrop-filter re-blurs it on every redraw.
function FrameLimiter({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!active) return
    const id = setInterval(invalidate, 1000 / TARGET_FPS)
    return () => clearInterval(id)
  }, [invalidate, active])
  return null
}

// The canvas is transparent over the page background, so its particle color
// must invert with the theme or it disappears. Always mounted client-only
// (dynamic ssr:false), so reading the DOM directly on first render is
// accurate — no flash.
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

function Particles({ reduceMotion, isDark }: { reduceMotion: boolean; isDark: boolean }) {
  const pointsRef = useRef<THREE.Points>(null)
  const matRef    = useRef<THREE.PointsMaterial>(null)

  // Fibonacci lattice — even distribution on a sphere surface
  const positions = useMemo(() => {
    const arr   = new Float32Array(COUNT * 3)
    const phi   = Math.PI * (Math.sqrt(5) - 1)
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const θ = phi * i
      arr[i * 3]     = r * Math.cos(θ) * RADIUS
      arr[i * 3 + 1] = y * RADIUS
      arr[i * 3 + 2] = r * Math.sin(θ) * RADIUS
    }
    return arr
  }, [])

  useFrame(({ clock }) => {
    if (reduceMotion) return
    const t = clock.elapsedTime
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.09
      pointsRef.current.rotation.x = Math.sin(t * 0.04) * 0.18
    }
    if (matRef.current) {
      // gentle breathing pulse
      matRef.current.opacity = 0.65 + Math.sin(t * 0.6) * 0.2
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.028}
        color={isDark ? '#ffffff' : '#111111'}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  )
}

// Faint equatorial ring for depth
function Ring({ reduceMotion, isDark }: { reduceMotion: boolean; isDark: boolean }) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const n   = 280
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const θ = (i / n) * Math.PI * 2
      // Deterministic pseudo-random jitter (seeded by index) — avoids impure
      // Math.random() calls during render while keeping the scattered look.
      const seed = Math.sin(i * 12.9898) * 43758.5453
      const jitter = seed - Math.floor(seed)
      arr[i * 3]     = Math.cos(θ) * (RADIUS + 0.35)
      arr[i * 3 + 1] = (jitter - 0.5) * 0.25
      arr[i * 3 + 2] = Math.sin(θ) * (RADIUS + 0.35)
    }
    return arr
  }, [])

  useFrame(({ clock }) => {
    if (reduceMotion) return
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * -0.05
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        color={isDark ? '#ffffff' : '#111111'}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  )
}

export default function ParticleSphere() {
  const reduceMotion = usePrefersReducedMotion()
  const isDark = useIsDarkTheme()

  return (
    <Canvas
      camera={{ position: [0, 0, 6.5], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true }}
      style={{ width: '100%', height: '100%' }}
      frameloop="demand"
    >
      <FrameLimiter active={!reduceMotion} />
      <Particles reduceMotion={reduceMotion} isDark={isDark} />
      <Ring reduceMotion={reduceMotion} isDark={isDark} />
    </Canvas>
  )
}
