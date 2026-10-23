'use client'

import { useState } from 'react'
import { m } from 'framer-motion'
import { submitTestimonial } from '@/actions/testimonials'
import StarRatingInput from '@/components/ui/StarRatingInput'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import Icon from '@/components/ui/Icon'

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
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-10 text-center flex flex-col items-center justify-center gap-4"
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(0,128,0,0.1)' }}>
          <Icon name="check" size={28} style={{ color: '#008000' }} />
        </div>
        <h3 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>{t.successTitle}</h3>
        <p style={{ color: 'var(--text-muted)' }}>{t.successText}</p>
      </m.div>
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
          style={{ background: 'rgba(217,0,0,0.1)', color: '#D90000', border: '1px solid rgba(217,0,0,0.25)', fontFamily: 'var(--font-poppins)' }}
        >
          {errorMsg}
        </p>
      )}

      <button type="submit" disabled={status === 'sending'} className="btn-primary w-full justify-center">
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
