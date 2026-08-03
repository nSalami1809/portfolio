'use client'

import { useState } from 'react'

const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'

// Interactive 1–5 star picker for the admin and public testimonial forms.
export default function StarRatingInput({ value, onChange, size = 24 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Note sur 5" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} étoile${i > 1 ? 's' : ''}`}
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={i <= display ? 'var(--accent)' : 'none'} stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round">
            <polygon points={STAR_POINTS} />
          </svg>
        </button>
      ))}
    </div>
  )
}
