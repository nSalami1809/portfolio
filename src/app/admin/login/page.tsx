'use client'

import { useActionState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { loginWithCredentials } from '@/actions/auth'
import type { LoginResult } from '@/actions/auth'
import PasswordInput from '@/components/ui/PasswordInput'

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginResult, FormData>(loginWithCredentials, null)
  const error = state && 'error' in state ? state.error : null

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Branding */}
        <div className="text-center mb-8">
          <motion.div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', boxShadow: '0 8px 28px rgba(139,92,246,0.4)' }}
            whileHover={{ scale: 1.05 }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </motion.div>
          <h1 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--text)' }}>
            Admin Panel
          </h1>
          <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            Portfolio NS · Accès sécurisé
          </p>
        </div>

        {/* Form */}
        <form action={action} className="card p-7 space-y-4">

          {/* Gradient top bar */}
          <div className="-mx-7 -mt-7 mb-5 h-0.5 rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#8B5CF6,#3B82F6)' }} />

          <div>
            <label htmlFor="email" className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              Adresse email
            </label>
            <input
              id="email" name="email" type="email"
              autoComplete="email" required
              placeholder="votre@email.com"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              Mot de passe
            </label>
            <PasswordInput
              id="password" name="password"
              autoComplete="current-password" required
              placeholder="••••••••••••"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="flex items-center gap-2.5 text-sm px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', fontFamily: 'var(--font-poppins)' }}
                  role="alert"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={pending} className="btn-primary w-full justify-center !mt-5">
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
                Continuer
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>

          <p className="text-center text-xs pt-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            Un code OTP vous sera envoyé par email
          </p>
        </form>
      </motion.div>
    </div>
  )
}
