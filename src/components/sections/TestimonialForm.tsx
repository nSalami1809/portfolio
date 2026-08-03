'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { submitTestimonial } from '@/actions/testimonials'
import StarRatingInput from '@/components/ui/StarRatingInput'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export default function TestimonialForm({ t }: { t: Dictionary['testimonialPage']['form'] }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ name: '', role: '', company: '', text: '', rating: 5 })

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')
    const result = await submitTestimonial(form)
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
        className="card p-10 text-center flex flex-col items-center justify-center gap-4"
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(16,185,129,0.1)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>{t.successTitle}</h3>
        <p style={{ color: 'var(--text-muted)' }}>{t.successText}</p>
      </motion.div>
    )
  }

  const fieldClass = 'input'
  const labelClass = 'block text-xs font-medium mb-2'

  return (
    <form onSubmit={submit} className="card p-8 space-y-5">
      <div>
        <label htmlFor="tf-name" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {t.nameLabel}
        </label>
        <input
          id="tf-name" type="text" name="name" value={form.name}
          onChange={handle} required maxLength={100}
          placeholder={t.namePlaceholder}
          className={fieldClass}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="tf-role" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {t.roleLabel}
          </label>
          <input
            id="tf-role" type="text" name="role" value={form.role}
            onChange={handle} maxLength={100}
            placeholder={t.rolePlaceholder}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="tf-company" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {t.companyLabel}
          </label>
          <input
            id="tf-company" type="text" name="company" value={form.company}
            onChange={handle} maxLength={100}
            placeholder={t.companyPlaceholder}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {t.ratingLabel}
        </label>
        <StarRatingInput value={form.rating} onChange={(rating) => setForm((p) => ({ ...p, rating }))} />
      </div>

      <div>
        <label htmlFor="tf-text" className={labelClass} style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
          {t.textLabel}
        </label>
        <textarea
          id="tf-text" name="text" value={form.text}
          onChange={handle} required rows={6} maxLength={1000}
          placeholder={t.textPlaceholder}
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

      <button type="submit" disabled={status === 'sending'} className="btn-primary w-full justify-center">
        {status === 'sending' ? (
          <>
            <motion.span
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </>
        )}
      </button>
    </form>
  )
}
