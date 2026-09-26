// Shared layout of the generated Open Graph images (1200×630): the same dark
// card as the site-wide one, with the page's own kicker, title and tags — so a
// link to an article or a project shows *that* page when it is shared.
import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

interface OgCardOptions {
  kicker: string
  title: string
  subtitle?: string
  tags?: string[]
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

export function ogCard({ kicker, title, subtitle, tags = [] }: OgCardOptions) {
  const size = title.length > 70 ? 46 : title.length > 40 ? 56 : 68
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
        <div
          style={{
            position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)', borderRadius: '50%',
          }}
        />

        <div
          style={{
            display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '999px', padding: '6px 16px', marginBottom: '28px',
          }}
        >
          <span style={{ color: '#d4d4d4', fontSize: '15px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{clip(kicker, 40)}</span>
        </div>

        <div style={{ display: 'flex', fontSize: `${size}px`, fontWeight: 700, color: '#ffffff', lineHeight: 1.1, marginBottom: '20px', letterSpacing: '-0.02em', maxWidth: '1000px' }}>
          {clip(title, 110)}
        </div>

        {subtitle ? (
          <div style={{ display: 'flex', fontSize: '26px', color: '#a3a3a3', marginBottom: '40px', fontWeight: 400, maxWidth: '980px', lineHeight: 1.35 }}>
            {clip(subtitle, 150)}
          </div>
        ) : null}

        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: '12px' }}>
            {tags.slice(0, 5).map((tag) => (
              <div key={tag} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '6px 14px', color: '#d4d4d4', fontSize: '15px' }}>
                {clip(tag, 24)}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', position: 'absolute', bottom: '48px', left: '80px', fontSize: '22px', color: '#a3a3a3' }}>
          Nawaf Nemrod Salami
        </div>
        <div style={{ display: 'flex', position: 'absolute', bottom: '48px', right: '80px', fontSize: '32px', fontWeight: 700, color: '#ffffff' }}>
          <span style={{ color: '#d4d4d4' }}>N</span>·S
        </div>
      </div>
    ),
    OG_SIZE,
  )
}
