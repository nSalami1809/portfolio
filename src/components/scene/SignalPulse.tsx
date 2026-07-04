'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sphere, Stars } from '@react-three/drei'
import * as THREE from 'three'

const RING_COUNT = 6

function PulseRing({ index }: { index: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const phase = (index / RING_COUNT) * Math.PI * 2

  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() * 0.5 + index * 0.9) % (RING_COUNT * 0.9)
    const progress = t / (RING_COUNT * 0.9)
    const scale = 0.4 + progress * 5.5
    const opacity = Math.max(0, 0.55 * (1 - progress))

    if (ref.current) {
      ref.current.scale.setScalar(scale)
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = opacity

      // Tilt each ring slightly differently for 3D feel
      ref.current.rotation.x = Math.PI / 2 + Math.sin(phase + clock.getElapsedTime() * 0.15) * 0.3
      ref.current.rotation.z = phase + clock.getElapsedTime() * 0.06 * (index % 2 === 0 ? 1 : -1)
    }
  })

  return (
    <mesh ref={ref}>
      <torusGeometry args={[1, 0.008, 16, 120]} />
      <meshBasicMaterial
        color={index % 3 === 0 ? '#8B5CF6' : index % 3 === 1 ? '#7C3AED' : '#A78BFA'}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function Core() {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime()
      const pulse = 1 + Math.sin(t * 2.2) * 0.06
      ref.current.scale.setScalar(pulse)
      const mat = ref.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.8 + Math.sin(t * 2.2) * 0.4
    }
  })

  return (
    <Float speed={1.0} floatIntensity={0.5} rotationIntensity={0.1}>
      <Sphere ref={ref} args={[0.38, 32, 32]}>
        <meshStandardMaterial
          color="#6D28D9"
          emissive="#8B5CF6"
          emissiveIntensity={1}
          roughness={0.1}
          metalness={0.9}
        />
      </Sphere>

      {/* Inner glow shell */}
      <Sphere args={[0.52, 32, 32]}>
        <meshBasicMaterial color="#8B5CF6" transparent opacity={0.06} side={THREE.BackSide} />
      </Sphere>
    </Float>
  )
}

function MouseGroup() {
  const groupRef = useRef<THREE.Group>(null)
  const target   = useRef(new THREE.Vector2())

  useFrame(({ mouse }) => {
    target.current.lerp(mouse, 0.05)
    if (groupRef.current) {
      groupRef.current.rotation.y =  target.current.x * 0.4
      groupRef.current.rotation.x = -target.current.y * 0.25
    }
  })

  return (
    <group ref={groupRef}>
      <Core />
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <PulseRing key={i} index={i} />
      ))}
    </group>
  )
}

export default function SignalPulse() {
  return (
    <div
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 58 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[4, 4, 4]}   intensity={1.3} color="#8B5CF6" />
        <pointLight position={[-4, -3, -4]} intensity={0.6} color="#4F46E5" />
        <pointLight position={[0, -4, 3]}   intensity={0.4} color="#C4B5FD" />

        <Stars radius={90} depth={60} count={1400} factor={3.5} fade speed={0.4} />

        <MouseGroup />
      </Canvas>
    </div>
  )
}
