import type { CSSProperties, ReactNode } from 'react'

// The two frames the pictures of a project are shown in. Pure decoration (aria-hidden);
// the picture is the content. Colours are fixed on purpose: a browser and a phone look the
// same in the light and in the dark theme.

const light = { chrome: '#e6e9ef', chromeLine: 'rgba(15,23,42,0.1)', field: '#ffffff', ink: '#64748b', icon: '#94a3b8' }

const trafficLight = (color: string): CSSProperties => ({ width: 11, height: 11, borderRadius: '50%', background: color, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)' })

const Icon = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

/** A desktop browser: traffic lights, back and forward, an address bar with a padlock, and the page below. */
export function BrowserWindow({ address, children }: { address: string; children: ReactNode }) {
  return (
    <div data-testid="gallery-window" style={{ borderRadius: 12, overflow: 'hidden', background: '#fff', border: '1px solid rgba(15,23,42,0.16)', boxShadow: '0 2px 4px rgba(15,23,42,0.06), 0 22px 48px -12px rgba(15,23,42,0.35)' }}>
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: `linear-gradient(#eef0f4, ${light.chrome})`, borderBottom: `1px solid ${light.chromeLine}` }}>
        <span style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
          <span style={trafficLight('#ff5f57')} /><span style={trafficLight('#febc2e')} /><span style={trafficLight('#28c840')} />
        </span>
        <span style={{ display: 'flex', gap: 10, color: light.icon, flexShrink: 0 }} className="hidden sm:flex">
          <Icon d="M15 18l-6-6 6-6" /><Icon d="M9 18l6-6-6-6" />
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', maxWidth: 440, background: light.field, borderRadius: 8, padding: '4px 12px', fontSize: 12, color: light.ink, fontFamily: 'var(--font-poppins)', boxShadow: `inset 0 0 0 1px ${light.chromeLine}` }}>
            <span style={{ color: light.icon, flexShrink: 0, display: 'inline-flex' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
            </span>
            <span style={{ flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 17 }}>{address}</span>
          </span>
        </span>
        <span style={{ display: 'flex', gap: 10, color: light.icon, flexShrink: 0 }} className="hidden sm:flex">
          <Icon d="M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" /><Icon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
        </span>
      </div>
      {children}
    </div>
  )
}

/**
 * An iPhone: titanium frame, side buttons, Dynamic Island and home indicator, in the proportions
 * of a 393 × 852 screen. The island and the indicator sit on top of the picture and let clicks through.
 */
export function IPhone({ children }: { children: ReactNode }) {
  const button = (side: 'left' | 'right', top: string, height: string): CSSProperties => ({
    position: 'absolute', [side]: -3, top, width: 3, height, background: 'linear-gradient(90deg, #3a404c, #1a1d24)', borderRadius: side === 'left' ? '3px 0 0 3px' : '0 3px 3px 0',
  })
  return (
    <div data-testid="gallery-phone" style={{ position: 'relative', width: 'min(100%, 300px)', marginInline: 'auto' }}>
      <span aria-hidden="true" style={button('left', '13%', '3.2%')} />
      <span aria-hidden="true" style={button('left', '20%', '6.5%')} />
      <span aria-hidden="true" style={button('left', '28.5%', '6.5%')} />
      <span aria-hidden="true" style={button('right', '24%', '10%')} />
      <div style={{ background: 'linear-gradient(145deg, #4a505c, #1b1e25 38%, #2c313b)', padding: 3, borderRadius: 52, boxShadow: '0 2px 4px rgba(15,23,42,0.1), 0 28px 50px -10px rgba(15,23,42,0.5)' }}>
        <div style={{ background: '#05060a', padding: 9, borderRadius: 49 }}>
          <div className="relative" style={{ aspectRatio: '393/852', overflow: 'hidden', borderRadius: 41, background: '#fff' }}>
            {children}
            <span
              aria-hidden="true"
              data-testid="gallery-island"
              style={{ position: 'absolute', top: '1.3%', left: '50%', transform: 'translateX(-50%)', width: '31%', aspectRatio: '126/37', background: '#000', borderRadius: 999, zIndex: 3, pointerEvents: 'none' }}
            />
            <span
              aria-hidden="true"
              style={{ position: 'absolute', bottom: '1.2%', left: '50%', transform: 'translateX(-50%)', width: '35%', height: 4, background: '#fff', borderRadius: 999, mixBlendMode: 'difference', zIndex: 3, pointerEvents: 'none' }}
            />
            <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.1), rgba(255,255,255,0) 32%)', pointerEvents: 'none', zIndex: 2 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
