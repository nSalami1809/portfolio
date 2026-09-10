'use client'

// Root-level fallback — catches an error that escapes even [locale]/error.tsx
// (e.g. one thrown by the root layout itself). Must render its own
// <html>/<body> since it replaces the whole root layout when active.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: '#FFFFFF', color: '#0B0B0F', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Une erreur est survenue
            </p>
            <p style={{ color: '#6B7280', marginBottom: '2rem', lineHeight: 1.6 }}>
              Ce n&apos;est pas grave — cliquez pour réessayer.
            </p>
            <button
              onClick={reset}
              style={{ background: '#111111', color: '#FFFFFF', border: 'none', padding: '0.75rem 1.75rem', cursor: 'pointer', fontWeight: 500 }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
