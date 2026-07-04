'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PersonalInfo, SocialLinks } from '@/types'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

interface Props {
  personal: PersonalInfo
  socials: SocialLinks
}

function TypingCursor() {
  return (
    <span
      aria-hidden="true"
      className="inline-block align-middle animate-pulse"
      style={{ width: 3, height: '0.85em', marginLeft: 3, background: 'var(--accent)' }}
    />
  )
}

export default function HeroSection({ personal, socials }: Props) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const line1 = 'Bonjour, je suis'
  const lastName = personal.name.split(' ').slice(-1)[0]
  const firstNames = personal.name.split(' ').slice(0, -1).join(' ')
  const boundary1 = line1.length
  const boundary2 = boundary1 + lastName.length
  const fullLength = boundary2 + firstNames.length

  const [typed, setTyped] = useState(0)

  useEffect(() => {
    setTyped(0)
    const startDelay = 700
    const speed = 45
    let interval: ReturnType<typeof setInterval> | undefined
    const timeout = setTimeout(() => {
      let i = 0
      interval = setInterval(() => {
        i++
        setTyped(i)
        if (i >= fullLength) clearInterval(interval)
      }, speed)
    }, startDelay)
    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [fullLength, personal.name])

  const t1 = line1.slice(0, Math.max(0, Math.min(line1.length, typed)))
  const t2 = lastName.slice(0, Math.max(0, Math.min(lastName.length, typed - boundary1)))
  const t3 = firstNames.slice(0, Math.max(0, Math.min(firstNames.length, typed - boundary2)))

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 40%, var(--accent-glow), transparent)' }}
      />

      {/* Drifting gradient blobs */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 480, height: 480, top: '-10%', left: '-8%',
          background: 'radial-gradient(circle, var(--accent-glow), transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 420, height: 420, bottom: '-15%', right: '-10%',
          background: 'radial-gradient(circle, var(--accent-glow), transparent 70%)',
          filter: 'blur(70px)',
        }}
        animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 w-full py-16">
        {/* Text */}
        <motion.div variants={container} initial="hidden" animate="show">
          {personal.photo && (
            <motion.div variants={item} className="mb-6">
              <img
                src={personal.photo}
                alt={personal.name}
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: '2px solid var(--accent)', boxShadow: '0 0 0 4px var(--accent-glow)' }}
              />
            </motion.div>
          )}

          <motion.div
            variants={item}
            className="inline-flex items-center gap-2 mb-5 px-3.5 py-1.5 rounded-full"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10B981' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#10B981' }} />
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              Disponible pour de nouvelles missions
            </span>
          </motion.div>

          <motion.p variants={item} className="section-label mb-5">
            Développeur Fullstack & DevOps
          </motion.p>

          <motion.h1
            variants={item}
            className="font-display font-bold leading-[1.05] mb-6"
            style={{ fontSize: 'clamp(2.8rem, 7vw, 5.5rem)', letterSpacing: '-0.03em' }}
          >
            <span style={{ color: 'var(--text)' }}>
              {t1}
              {typed < boundary1 && <TypingCursor />}
            </span>
            <br />
            <span className="relative inline-block">
              <span
                aria-hidden="true"
                className="absolute inset-0 -z-10 select-none"
                style={{ color: 'var(--accent)', opacity: 0.4, filter: 'blur(28px)' }}
              >
                {lastName}
              </span>
              <span className="gradient-text">
                {t2}
                {typed >= boundary1 && typed < boundary2 && <TypingCursor />}
              </span>
            </span>
            <br />
            <span style={{ color: 'var(--text)' }}>
              {t3}
              {typed >= boundary2 && <TypingCursor />}
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            className="text-lg leading-relaxed mb-10 max-w-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            {personal.bio}
          </motion.p>

          <motion.div variants={item} className="flex flex-wrap gap-4 mb-10">
            <Link href="/projects" className="btn-primary">
              Voir mes projets
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <Link href="/contact" className="btn-secondary">
              Me contacter
            </Link>
          </motion.div>

          {/* Socials */}
          <motion.div variants={item} className="flex items-center gap-4">
            {socials.github && (
              <a href={socials.github} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="GitHub"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
              </a>
            )}
            {socials.linkedin && (
              <a href={socials.linkedin} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="LinkedIn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            )}
            {socials.facebook && (
              <a href={socials.facebook} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Facebook"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            )}
            {socials.instagram && (
              <a href={socials.instagram} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Instagram"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            )}
            {personal.email && (
              <a href={`mailto:${personal.email}`}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Email"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </a>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <AnimatePresence>
        {!scrolled && (
          <motion.a
            href="#apropos"
            aria-label="Défiler vers la section À propos"
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 cursor-pointer group z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 8, 0] }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{
              opacity: { delay: 1.5 },
              y: { delay: 1.5, duration: 2, repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            <span
              className="text-xs font-semibold tracking-widest transition-colors duration-200 group-hover:opacity-100"
              style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-poppins)' }}
            >
              SCROLL
            </span>
            <div
              className="relative w-7 h-11 rounded-full flex justify-center pt-2.5 transition-transform duration-200 group-hover:scale-110"
              style={{
                border: '2px solid var(--accent)',
                background: 'var(--glass-bg)',
                boxShadow: '0 0 20px var(--accent-glow), inset 0 1px 0 var(--glass-highlight)',
              }}
            >
              <motion.div
                animate={{ y: [0, 14, 0], opacity: [1, 0, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            </div>
          </motion.a>
        )}
      </AnimatePresence>
    </section>
  )
}
