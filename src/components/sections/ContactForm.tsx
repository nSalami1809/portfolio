'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { submitContact } from '@/actions/contact'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

function checkEmailFormat(v: string): string {
  if (!v) return ''
  return EMAIL_RE.test(v) ? '' : 'Format invalide — ex: prenom@domaine.com'
}

export default function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    customSubject: '',
    message: '',
  })
  const [emailError, setEmailError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setForm((p) => ({ ...p, email: v }))
    if (emailTouched) setEmailError(checkEmailFormat(v))
  }

  const handleEmailBlur = () => {
    setEmailTouched(true)
    setEmailError(checkEmailFormat(form.email))
  }

  const emailValid = emailTouched && form.email.length > 0 && emailError === ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Force-check email before submission
    const fmtErr = checkEmailFormat(form.email)
    setEmailTouched(true)
    setEmailError(fmtErr)
    if (fmtErr || !form.email) return
    setStatus('sending')
    setErrorMsg('')
    const result = await submitContact(form)
    if (result.ok) {
      setStatus('sent')
    } else {
      setStatus('error')
      setErrorMsg(result.error)
    }
  }

  if (status === 'sent') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-10 text-center h-full flex flex-col items-center justify-center gap-4"
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
          style={{ background: 'rgba(16,185,129,0.1)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h3 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>
          Message envoyé !
        </h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Merci — je vous répondrai sous 48 heures ouvrables.
        </p>
      </motion.div>
    )
  }

  const fieldClass = 'input'
  const labelClass = 'block text-xs font-medium mb-2'

  return (
    <form onSubmit={submit} className="card p-8 space-y-5">

      {/* Nom + Email */}
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="cf-name" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Nom complet *
          </label>
          <input
            id="cf-name" type="text" name="name" value={form.name}
            onChange={handle} required maxLength={100}
            placeholder="Prénom Nom"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="cf-email" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Email *
          </label>
          <div className="relative">
            <input
              id="cf-email" type="email" name="email" value={form.email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              required maxLength={254}
              placeholder="adresse@email.com"
              aria-invalid={emailError ? 'true' : undefined}
              aria-describedby={emailError ? 'cf-email-error' : undefined}
              className={fieldClass}
              style={{
                paddingRight: emailTouched && form.email ? '2.5rem' : undefined,
                borderColor: emailError
                  ? 'rgba(239,68,68,0.7)'
                  : emailValid
                  ? 'rgba(16,185,129,0.6)'
                  : undefined,
              }}
            />
            {/* Status icon */}
            {emailTouched && form.email.length > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {emailError ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                )}
              </span>
            )}
          </div>
          {emailError && (
            <p id="cf-email-error" role="alert" className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: '#EF4444', fontFamily: 'var(--font-poppins)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {emailError}
            </p>
          )}
        </div>
      </div>

      {/* Téléphone */}
      <div>
        <label className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Téléphone
          <span className="ml-2 text-[10px] font-normal opacity-50">(optionnel)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-subtle)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </span>
          <input
            id="cf-phone" type="tel" name="phone" value={form.phone}
            onChange={handle} maxLength={30}
            placeholder="+241 ..."
            className={fieldClass}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
      </div>

      {/* Sujet */}
      <div>
        <label className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Sujet *
        </label>
        <select
          id="cf-subject" name="subject" value={form.subject}
          onChange={handle} required
          className={fieldClass}
          style={{ appearance: 'none' }}
        >
          <option value="" disabled>Sélectionner un sujet</option>
          <option value="mission">Mission / Projet freelance</option>
          <option value="collaboration">Collaboration</option>
          <option value="conseil">Conseil technique</option>
          <option value="autre">Autre</option>
        </select>
      </div>

      {/* Objet personnalisé si "Autre" */}
      <AnimatePresence>
        {form.subject === 'autre' && (
          <motion.div
            key="customSubject"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <label className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              Précisez l&apos;objet *
            </label>
            <input
              id="cf-custom-subject" type="text" name="customSubject" value={form.customSubject}
              onChange={handle} maxLength={120}
              required={form.subject === 'autre'}
              placeholder="Indiquez l'objet de votre message"
              className={fieldClass}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message */}
      <div>
        <label className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          Message *
        </label>
        <textarea
          id="cf-message" name="message" value={form.message}
          onChange={handle} required rows={6} maxLength={3000}
          placeholder="Décrivez votre besoin, vos contraintes, vos objectifs…"
          className={fieldClass}
          style={{ resize: 'none' }}
        />
      </div>

      {status === 'error' && (
        <p
          className="text-sm px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'var(--font-poppins)' }}
        >
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending' || !!emailError}
        className="btn-primary w-full justify-center"
      >
        {status === 'sending' ? (
          <>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-t-transparent rounded-full"
              style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: 'transparent' }}
            />
            Envoi en cours…
          </>
        ) : (
          <>
            Envoyer le message
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </>
        )}
      </button>
    </form>
  )
}
