'use client'

import { useState, forwardRef } from 'react'
import Icon from '@/components/ui/Icon'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { className = 'input', style, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        ref={ref}
        {...props}
        type={visible ? 'text' : 'password'}
        className={className}
        style={{ paddingRight: '2.75rem', ...style }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer' : 'Afficher'}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
        style={{ color: 'var(--text-subtle)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
      >
        {visible ? (
          <Icon name="eyeOff" size={16} />
        ) : (
          <Icon name="eye" size={16} />
        )}
      </button>
    </div>
  )
})

export default PasswordInput
