'use client'

import { useEffect, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { submitContact } from '@/actions/contact'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import Icon from '@/components/ui/Icon'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

export default function ContactForm({ t }: { t: Dictionary['contact']['form'] }) {
  const checkEmailFormat = (v: string): string => {
    if (!v) return ''
    return EMAIL_RE.test(v) ? '' : t.emailInvalid
  }
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

  // "Write to Nawaf" from the chat arrives with the visitor's last question in ?message=.
  // Read after hydration (never during render) and only into an empty message box. Plain
  // text in a textarea, bounded: nothing in it is ever interpreted.
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get('message')?.slice(0, 500)
    if (!prefill) return
    Promise.resolve().then(() => setForm((p) => (p.message ? p : { ...p, message: prefill })))
  }, [])

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
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-10 text-center h-full flex flex-col items-center justify-center gap-4"
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
          style={{ background: 'rgba(0,128,0,0.1)' }}
        >
          <Icon name="check" size={28} style={{ color: '#008000' }} />
        </div>
        <h3 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>
          {t.successTitle}
        </h3>
        <p style={{ color: 'var(--text-muted)' }}>
          {t.successText}
        </p>
      </m.div>
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
            {t.nameLabel}
          </label>
          <input
            id="cf-name" type="text" name="name" autoComplete="name" value={form.name}
            onChange={handle} required maxLength={100}
            placeholder={t.namePlaceholder}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="cf-email" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {t.emailLabel}
          </label>
          <div className="relative">
            <input
              id="cf-email" type="email" inputMode="email" autoComplete="email" name="email" value={form.email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              required maxLength={254}
              placeholder={t.emailPlaceholder}
              aria-invalid={emailError ? 'true' : undefined}
              aria-describedby={emailError ? 'cf-email-error' : undefined}
              className={fieldClass}
              style={{
                paddingRight: emailTouched && form.email ? '2.5rem' : undefined,
                borderColor: emailError
                  ? 'rgba(217,0,0,0.7)'
                  : emailValid
                  ? 'rgba(0,128,0,0.6)'
                  : undefined,
              }}
            />
            {/* Status icon */}
            {emailTouched && form.email.length > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {emailError ? (
                  <Icon name="closeCircle" size={16} style={{ color: '#D90000' }} />
                ) : (
                  <Icon name="success" size={16} style={{ color: '#008000' }} />
                )}
              </span>
            )}
          </div>
          {emailError && (
            <p id="cf-email-error" role="alert" className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: '#D90000', fontFamily: 'var(--font-poppins)' }}>
              <Icon name="alert" size={11} />
              {emailError}
            </p>
          )}
        </div>
      </div>

      {/* Téléphone */}
      <div>
        <label htmlFor="cf-phone" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {t.phoneLabel}
          <span className="ml-2 text-[10px] font-normal opacity-50">{t.phoneOptional}</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-subtle)' }}>
            <Icon name="phone" size={15} />
          </span>
          <input
            id="cf-phone" type="tel" inputMode="tel" autoComplete="tel" name="phone" value={form.phone}
            onChange={handle} maxLength={30}
            placeholder={t.phonePlaceholder}
            className={fieldClass}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
      </div>

      {/* Sujet */}
      <div>
        <label htmlFor="cf-subject" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {t.subjectLabel}
        </label>
        <select
          id="cf-subject" name="subject" value={form.subject}
          onChange={handle} required
          className={fieldClass}
          style={{ appearance: 'none' }}
        >
          <option value="" disabled>{t.subjectPlaceholder}</option>
          <option value="mission">{t.subjectMission}</option>
          <option value="collaboration">{t.subjectCollaboration}</option>
          <option value="conseil">{t.subjectConseil}</option>
          <option value="autre">{t.subjectAutre}</option>
        </select>
      </div>

      {/* Objet personnalisé si "Autre" */}
      <AnimatePresence>
        {form.subject === 'autre' && (
          <m.div
            key="customSubject"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <label htmlFor="cf-custom-subject" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
              {t.customSubjectLabel}
            </label>
            <input
              id="cf-custom-subject" type="text" name="customSubject" value={form.customSubject}
              onChange={handle} maxLength={120}
              required={form.subject === 'autre'}
              placeholder={t.customSubjectPlaceholder}
              className={fieldClass}
            />
          </m.div>
        )}
      </AnimatePresence>

      {/* Message */}
      <div>
        <label htmlFor="cf-message" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {t.messageLabel}
        </label>
        <textarea
          id="cf-message" name="message" value={form.message}
          onChange={handle} required rows={6} maxLength={3000}
          placeholder={t.messagePlaceholder}
          className={fieldClass}
          style={{ resize: 'none' }}
        />
      </div>

      {status === 'error' && (
        <p
          className="text-sm px-4 py-3 rounded-xl"
          style={{ background: 'rgba(217,0,0,0.1)', color: '#D90000', border: '1px solid rgba(217,0,0,0.25)', fontFamily: 'var(--font-poppins)' }}
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
            <m.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-t-transparent rounded-full"
              style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: 'transparent' }}
            />
            {t.sending}
          </>
        ) : (
          <>
            {t.send}
            <Icon name="send" size={16} />
          </>
        )}
      </button>
    </form>
  )
}
