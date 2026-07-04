'use client'
/* eslint-disable react-hooks/purity */

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Icosahedron, Points, PointMaterial, Stars, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

/* ── Mouse-reactive group ────────────────────────────────────────── */
function Scene() {
  const groupRef = useRef<THREE.Group>(null)
  const { viewport, mouse } = useThree()
  const target = useRef(new THREE.Vector2())

  useFrame(() => {
    // Smooth mouse tracking
    target.current.lerp(mouse, 0.06)
    if (groupRef.current) {
      groupRef.current.rotation.y = target.current.x * 0.35
      groupRef.current.rotation.x = -target.current.y * 0.2
    }
  })

  return (
    <group ref={groupRef}>
      <Orb />
      <Particles count={2000} />
      <Ring tiltX={Math.PI / 2.3} speed={0.06} radius={2.3} opacity={0.5} />
      <Ring tiltX={Math.PI / 3.2} speed={-0.04} radius={2.9} opacity={0.25} />
    </group>
  )
}

/* ── Central orb ─────────────────────────────────────────────────── */
function Orb() {
  const outerRef = useRef<THREE.Mesh>(null)
  const innerRef  = useRef<THREE.Mesh>(null)
  const coreRef   = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (outerRef.current) {
      outerRef.current.rotation.x = t * 0.11
      outerRef.current.rotation.y = t * 0.17
    }
    if (innerRef.current) {
      innerRef.current.rotation.x = -t * 0.08
      innerRef.current.rotation.y = -t * 0.13
    }
    if (coreRef.current) {
      const s = 1 + Math.sin(t * 1.2) * 0.04
      coreRef.current.scale.setScalar(s)
    }
  })

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={1}>
      {/* Outer wireframe — large */}
      <Icosahedron ref={outerRef} args={[1.75, 1]}>
        <meshBasicMaterial color="#8B5CF6" wireframe transparent opacity={0.28} />
      </Icosahedron>

      {/* Mid wireframe */}
      <Icosahedron ref={innerRef} args={[1.25, 1]}>
        <meshBasicMaterial color="#A78BFA" wireframe transparent opacity={0.18} />
      </Icosahedron>

      {/* Core — pulsing glow */}
      <Icosahedron ref={coreRef} args={[0.72, 0]}>
        <meshStandardMaterial
          color="#7C3AED"
          emissive="#5B21B6"
          emissiveIntensity={1.2}
          roughness={0.1}
          metalness={0.9}
        />
      </Icosahedron>
    </Float>
  )
}

/* ── Particle cloud ──────────────────────────────────────────────── */
function Particles({ count = 1400 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r     = 3.2 + Math.random() * 3.8
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.035
      ref.current.rotation.x = clock.getElapsedTime() * 0.018
    }
  })

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#C4B5FD"
        size={0.028}
        sizeAttenuation
        depthWrite={false}
        opacity={0.8}
      />
    </Points>
  )
}

/* ── Orbital ring ────────────────────────────────────────────────── */
interface RingProps {
  tiltX: number
  speed: number
  radius: number
  opacity: number
}
function Ring({ tiltX, speed, radius, opacity }: RingProps) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.x = tiltX + Math.sin(clock.getElapsedTime() * 0.25) * 0.06
      ref.current.rotation.z = clock.getElapsedTime() * speed
    }
  })

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.006, 16, 140]} />
      <meshBasicMaterial color="#7C3AED" transparent opacity={opacity} />
    </mesh>
  )
}

/* ── Canvas wrapper ──────────────────────────────────────────────── */
interface TechOrbProps {
  height?: number
  fullscreen?: boolean
}

export default function TechOrb({ height = 620, fullscreen = false }: TechOrbProps) {
  const style: React.CSSProperties = fullscreen
    ? {
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        cursor: 'default',
      }
    : {
        width: 'calc(100% + 80px)',
        height,
        marginLeft: '-40px',
        marginRight: '-40px',
        cursor: 'grab',
      }

  return (
    <div style={style} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 65 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]}   intensity={1.4} color="#8B5CF6" />
        <pointLight position={[-5, -3, -5]} intensity={0.7} color="#4F46E5" />
        <pointLight position={[0, -4, 3]}   intensity={0.4} color="#C4B5FD" />

        <Stars radius={90} depth={60} count={1800} factor={4} fade speed={0.5} />

        <Scene />

        {!fullscreen && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            rotateSpeed={0.5}
            autoRotate={false}
          />
        )}
      </Canvas>
    </div>
  )
}
