const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'

// Read-only display: filled stars up to `rating`, plus the numeric value.
export default function StarRating({ rating, size = 13, showValue = true }: { rating: number; size?: number; showValue?: boolean }) {
  const clamped = Math.min(5, Math.max(0, rating))
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`${clamped} sur 5 étoiles`}>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= clamped ? 'var(--accent)' : 'none'} stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round">
            <polygon points={STAR_POINTS} />
          </svg>
        ))}
      </div>
      {showValue && (
        <span className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>{clamped.toFixed(1)}/5</span>
      )}
    </div>
  )
}
