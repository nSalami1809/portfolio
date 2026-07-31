import { ImageResponse } from 'next/og'

export const alt = 'Nawaf Nemrod Salami — Développeur Fullstack & DevOps'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #000000 50%, #0d0d0d 100%)',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '999px',
            padding: '6px 16px',
            marginBottom: '28px',
          }}
        >
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} />
          <span style={{ color: '#d4d4d4', fontSize: '14px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Disponible pour missions
          </span>
        </div>

        {/* Name */}
        <div
          style={{
            display: 'flex',
            fontSize: '68px',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.05,
            marginBottom: '16px',
            letterSpacing: '-0.02em',
          }}
        >
          Nawaf Nemrod{' '}
          <span style={{ color: '#d4d4d4' }}>Salami</span>
        </div>

        {/* Role */}
        <div style={{ fontSize: '26px', color: '#a3a3a3', marginBottom: '48px', fontWeight: 400 }}>
          Développeur Fullstack &amp; DevOps
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {['Next.js', 'TypeScript', 'Docker', 'Kubernetes', 'Node.js'].map((tag) => (
            <div
              key={tag}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                padding: '6px 14px',
                color: '#d4d4d4',
                fontSize: '15px',
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* Bottom logo */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: '48px',
            right: '80px',
            fontSize: '32px',
            fontWeight: 700,
            color: '#ffffff',
          }}
        >
          <span style={{ color: '#d4d4d4' }}>N</span>·S
        </div>
      </div>
    ),
    size,
  )
}
