'use client'

import { useState, useActionState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/providers/ThemeProvider'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import PasswordInput from '@/components/ui/PasswordInput'
import { changePassword } from '@/actions/auth'
import type { ChangePasswordResult } from '@/actions/auth'


export default function AdminSettings() {
  const { data, updateSettings } = usePortfolio()
  const toast = useToast()
  const [settings, setSettings] = useState(data.settings)
  const { setTheme } = useTheme()

  const [pwState, pwAction, pwPending] = useActionState<ChangePasswordResult | null, FormData>(changePassword, null)

  const save = () => {
    updateSettings(settings)
    setTheme(settings.defaultTheme)
    toast('Paramètres sauvegardés')
  }

  const pwOk    = pwState && 'ok' in pwState
  const pwError = pwState && 'error' in pwState ? pwState.error : null

  return (
    <div className="space-y-6" style={{ maxWidth: '600px' }}>
      <div>
        <h1 className="font-display font-bold text-2xl leading-tight mb-1" style={{ color: 'var(--text)' }}>
          Paramètres du site
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Configurez l&apos;apparence et les options générales du portfolio.
        </p>
      </div>

      {/* Theme */}
      <section className="card no-lift p-6">
        <p className="section-label mb-4">Thème par défaut</p>
        <div className="grid grid-cols-2 gap-3">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSettings((p) => ({ ...p, defaultTheme: t }))}
              aria-pressed={settings.defaultTheme === t}
              className="p-4 rounded-xl text-left transition-all duration-200"
              style={{
                border: `2px solid ${settings.defaultTheme === t ? 'var(--accent)' : 'var(--border)'}`,
                background: settings.defaultTheme === t ? 'var(--accent-glow)' : 'var(--surface)',
              }}
            >
              <div
                className="w-9 h-9 rounded-full mb-3 flex items-center justify-center"
                style={{ background: t === 'dark' ? '#0B0B0F' : '#F8F8FF', border: '1px solid var(--border)' }}
                aria-hidden="true"
              >
                {t === 'dark' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                )}
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                {t === 'dark' ? 'Sombre' : 'Clair'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                {t === 'dark' ? 'Interface noire' : 'Interface blanche'}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Save site settings */}
      <div className="pb-2">
        <button onClick={save} className="btn-primary btn-sm">
          Sauvegarder les paramètres
        </button>
      </div>

      {/* ── Security ───────────────────────────────────────────────────────── */}
      <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <h2 className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>
          Sécurité
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Modifiez votre mot de passe d&apos;administration.
        </p>
      </div>

      <section className="card no-lift p-6">
        <p className="section-label mb-5">Changer le mot de passe</p>

        <AnimatePresence mode="wait">
          {pwOk ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
              style={{
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                color: '#10B981',
                fontFamily: 'var(--font-poppins)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Mot de passe modifié avec succès.
            </motion.div>
          ) : (
            <motion.form key="form" action={pwAction} className="space-y-4">
              <div>
                <label htmlFor="current" className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                  Mot de passe actuel
                </label>
                <PasswordInput
                  id="current" name="current"
                  required autoComplete="current-password"
                  placeholder="Mot de passe actuel"
                />
              </div>

              <div>
                <label htmlFor="next" className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                  Nouveau mot de passe
                </label>
                <PasswordInput
                  id="next" name="next"
                  required minLength={8} autoComplete="new-password"
                  placeholder="8 caractères minimum"
                />
              </div>

              <div>
                <label htmlFor="confirm" className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                  Confirmer le nouveau mot de passe
                </label>
                <PasswordInput
                  id="confirm" name="confirm"
                  required minLength={8} autoComplete="new-password"
                  placeholder="Répétez le nouveau mot de passe"
                />
              </div>

              <AnimatePresence>
                {pwError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-2.5 text-sm px-4 py-3 rounded-xl"
                      style={{
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: '#EF4444',
                        fontFamily: 'var(--font-poppins)',
                      }}
                      role="alert"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {pwError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" disabled={pwPending} className="btn-primary btn-sm">
                {pwPending ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-3.5 h-3.5 border-2 rounded-full"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                    />
                    Enregistrement...
                  </>
                ) : 'Modifier le mot de passe'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}
