'use client'
/* eslint-disable react-hooks/refs */

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

const COLS = 60
const ROWS = 40
const SPACING = 0.32

function Wave() {
  const ref = useRef<THREE.Points>(null)

  const { positions, count } = useMemo(() => {
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
    return { positions, count }
  }, [])

  const posRef = useRef(positions.slice())

  useFrame(({ clock }) => {
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
        color="#60A5FA"
        size={0.045}
        sizeAttenuation
        depthWrite={false}
        opacity={0.75}
      />
    </Points>
  )
}

function SecondaryWave() {
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
        color="#93C5FD"
        size={0.025}
        sizeAttenuation
        depthWrite={false}
        opacity={0.35}
      />
    </Points>
  )
}

export default function ParticleWave() {
  return (
    <div
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 5.5, 7], fov: 60 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[0, 8, 0]} intensity={1.2} color="#3B82F6" />
        <pointLight position={[-6, 2, 4]} intensity={0.6} color="#1D4ED8" />

        <Wave />
        <SecondaryWave />
      </Canvas>
    </div>
  )
}
