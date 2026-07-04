'use client'

import { useRef, useState, useCallback, useEffect, useActionState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { verifyOTPAction } from '@/actions/auth'
import type { VerifyOTPResult } from '@/actions/auth'

const LENGTH = 6

export default function VerifyPage() {
  const router = useRouter()
  const [digits, setDigits]   = useState<string[]>(Array(LENGTH).fill(''))
  const [focused, setFocused] = useState<number | null>(null)
  const [shake, setShake]     = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(LENGTH).fill(null))
  const formRef   = useRef<HTMLFormElement>(null)

  const [state, action, pending] = useActionState<VerifyOTPResult, FormData>(verifyOTPAction, null)

  // Shake on error
  useEffect(() => {
    if (state && 'error' in state) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShake(true)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDigits(Array(LENGTH).fill(''))
      inputRefs.current[0]?.focus()
      setTimeout(() => setShake(false), 500)
    }
  }, [state])

  const submit = useCallback((allDigits: string[]) => {
    if (allDigits.some((d) => d === '')) return
    if (!formRef.current) return
    const fd = new FormData(formRef.current)
    fd.set('otp', allDigits.join(''))
    startTransition(() => action(fd))
  }, [action])

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = digit
    setDigits(next)
    if (digit && i < LENGTH - 1) {
      inputRefs.current[i + 1]?.focus()
    }
    if (digit && i === LENGTH - 1) {
      submit(next)
    }
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits]; next[i] = ''; setDigits(next)
      } else if (i > 0) {
        inputRefs.current[i - 1]?.focus()
        const next = [...digits]; next[i - 1] = ''; setDigits(next)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputRefs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < LENGTH - 1) {
      inputRefs.current[i + 1]?.focus()
    } else if (e.key === 'Enter') {
      submit(digits)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return
    const next = [...digits]
    pasted.split('').forEach((ch, idx) => { next[idx] = ch })
    setDigits(next)
    const lastFilled = Math.min(pasted.length, LENGTH - 1)
    inputRefs.current[lastFilled]?.focus()
    if (pasted.length === LENGTH) submit(next)
  }

  const filled = digits.filter((d) => d !== '').length
  const error  = state && 'error' in state ? state.error : null

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--accent)', boxShadow: '0 8px 28px rgba(139,92,246,0.4)' }}
            animate={{ scale: pending ? 0.92 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </motion.div>
          <h1 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--text)' }}>
            Vérification OTP
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Entrez le code à 6 chiffres reçu par email
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-6">

          {/* OTP boxes */}
          <form ref={formRef} action={action}>
            <input type="hidden" name="otp" value={digits.join('')} readOnly />

            <motion.div
              className="flex justify-center gap-2.5"
              animate={shake ? { x: [0, -8, 8, -8, 8, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.45 }}
            >
              {digits.map((digit, i) => (
                <motion.div
                  key={i}
                  className="relative"
                  animate={{ scale: focused === i ? 1.06 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <input
                    ref={(el) => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    onFocus={() => setFocused(i)}
                    onBlur={() => setFocused(null)}
                    disabled={pending}
                    aria-label={`Chiffre ${i + 1}`}
                    className="text-center font-display font-bold text-2xl outline-none transition-all duration-150 caret-transparent"
                    style={{
                      width: '46px',
                      height: '56px',
                      borderRadius: '10px',
                      border: `2px solid ${
                        digit
                          ? 'var(--accent)'
                          : focused === i
                          ? 'var(--accent)'
                          : 'var(--border)'
                      }`,
                      background: digit
                        ? 'var(--accent-glow)'
                        : focused === i
                        ? 'var(--surface-hover)'
                        : 'var(--surface)',
                      color: 'var(--text)',
                      boxShadow: focused === i
                        ? '0 0 0 3px rgba(139,92,246,0.15)'
                        : 'none',
                    }}
                  />
                  {/* Caret indicator on focused empty box */}
                  {focused === i && !digit && (
                    <motion.div
                      className="absolute left-1/2 bottom-3 -translate-x-1/2 w-0.5 rounded-full"
                      style={{ height: '18px', background: 'var(--accent)' }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mt-4">
              {Array.from({ length: LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i < filled ? '18px' : '6px',
                    height: '6px',
                    background: i < filled ? 'var(--accent)' : 'var(--border)',
                  }}
                />
              ))}
            </div>
          </form>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm px-3 py-2.5 rounded-xl text-center"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'var(--font-poppins)' }}
                role="alert"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit button */}
          <button
            type="button"
            onClick={() => submit(digits)}
            disabled={pending || filled < LENGTH}
            className="btn-primary w-full justify-center"
          >
            {pending ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 rounded-full"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                />
                Vérification…
              </>
            ) : (
              <>
                Confirmer
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>

          {/* Resend */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push('/admin/login')}
              className="text-xs hover:underline transition-colors"
              style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}
            >
              Renvoyer un code
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
