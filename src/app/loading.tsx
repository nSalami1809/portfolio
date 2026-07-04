export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
      style={{ background: 'var(--bg)' }}
    >
      {/* Logo mark */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #5B21B6 100%)' }}
      >
        <span
          className="font-display font-bold text-xl text-white select-none"
          style={{ letterSpacing: '-0.03em' }}
        >
          N
        </span>
      </div>

      {/* Spinner */}
      <div className="relative w-8 h-8">
        <div
          className="absolute inset-0 rounded-full border-2 animate-spin"
          style={{
            borderColor: 'rgba(139,92,246,0.15)',
            borderTopColor: '#8B5CF6',
          }}
        />
      </div>

      {/* Label */}
      <p
        className="text-xs tracking-[0.2em] uppercase"
        style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}
      >
        Chargement
      </p>
    </div>
  )
}
