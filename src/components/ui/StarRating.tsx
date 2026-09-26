// Read-only display: filled stars up to `rating`, plus the numeric value.
//
// One element, not five inline SVGs: the five-star row is a CSS mask (see
// `.stars` in globals.css) whose filled part is set by `--r`. A testimonials
// marquee shows dozens of these, and each used to cost five <svg> elements in
// the HTML *and* again in the hydration payload.
export default function StarRating({ rating, size = 13, showValue = true }: { rating: number; size?: number; showValue?: boolean }) {
  const clamped = Math.min(5, Math.max(0, rating))
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`${clamped} sur 5 étoiles`}>
      <span className="stars" aria-hidden="true" style={{ '--r': clamped, '--s': `${size}px` } as React.CSSProperties} />
      {showValue && (
        <span className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>{clamped.toFixed(1)}/5</span>
      )}
    </div>
  )
}
