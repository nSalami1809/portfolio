'use client'

import { useState, useActionState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import PasswordInput from '@/components/ui/PasswordInput'
import { changePassword, changeEmail } from '@/actions/auth'
import type { ChangePasswordResult, ChangeEmailResult } from '@/actions/auth'


export default function AdminSettings() {
  const { data, updateSettings } = usePortfolio()
  const toast = useToast()
  const [settings, setSettings] = useState(data.settings)

  // Adopt the shared context's settings until this page makes its own edit
  const localOwned = useRef(false)
  useEffect(() => {
    if (!localOwned.current) setSettings(data.settings)
  }, [data.settings])

  const [pwState, pwAction, pwPending] = useActionState<ChangePasswordResult | null, FormData>(changePassword, null)
  const [emailState, emailAction, emailPending] = useActionState<ChangeEmailResult | null, FormData>(changeEmail, null)

  const save = () => {
    localOwned.current = true
    updateSettings(settings)
    toast('Paramètres sauvegardés')
  }

  const pwOk    = pwState && 'ok' in pwState
  const pwError = pwState && 'error' in pwState ? pwState.error : null

  const emailOk    = emailState && 'ok' in emailState ? emailState : null
  const emailError = emailState && 'error' in emailState ? emailState.error : null

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

      <section className="card no-lift p-6">
        <p className="section-label mb-5">Changer l&apos;adresse email</p>

        <AnimatePresence mode="wait">
          {emailOk ? (
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
              Adresse email mise à jour : {emailOk.email}. Utilisez-la dès la prochaine connexion.
            </motion.div>
          ) : (
            <motion.form key="form" action={emailAction} className="space-y-4">
              <div>
                <label htmlFor="newEmail" className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                  Nouvelle adresse email
                </label>
                <input
                  id="newEmail" name="email" type="email"
                  required autoComplete="email"
                  placeholder="nouvelle@adresse.com"
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="confirmEmail" className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                  Confirmer la nouvelle adresse email
                </label>
                <input
                  id="confirmEmail" name="confirmEmail" type="email"
                  required autoComplete="email"
                  placeholder="Répétez la nouvelle adresse"
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="emailPassword" className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                  Mot de passe actuel
                </label>
                <PasswordInput
                  id="emailPassword" name="password"
                  required autoComplete="current-password"
                  placeholder="Confirmez avec votre mot de passe"
                />
              </div>

              <AnimatePresence>
                {emailError && (
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
                      {emailError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" disabled={emailPending} className="btn-primary btn-sm">
                {emailPending ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-3.5 h-3.5 border-2 rounded-full"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                    />
                    Enregistrement...
                  </>
                ) : "Modifier l'adresse email"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      {/* ── Data export ────────────────────────────────────────────────────── */}
      <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <h2 className="font-display font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>
          Sauvegarde des données
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Téléchargez une copie complète de vos données (portfolio, devis, messages, rendez-vous, liste d&apos;attente) au format JSON.
        </p>
      </div>

      <section className="card no-lift p-6">
        <a href="/api/admin-export" download className="btn-secondary btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Télécharger la sauvegarde (JSON)
        </a>
      </section>
    </div>
  )
}
