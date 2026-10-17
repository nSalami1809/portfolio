'use client'

// The robot of the chat: the avatar of the public chatbot, shared with the admin
// assistant so both wear the same face. Moved here unchanged from ChatWidget.
import { m } from 'framer-motion'

export type BotMood = 'idle' | 'thinking' | 'happy' | 'excited' | 'confused'

export function BotIcon({ mood = 'idle', ...props }: React.SVGProps<SVGSVGElement> & { mood?: BotMood }) {
  const eyeOrigin = { transformBox: 'fill-box' as const, transformOrigin: 'center' as const }
  const bigEyes = mood === 'happy' || mood === 'excited'
  const tilt = mood === 'confused'

  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <m.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={tilt ? { rotate: [-7, 7, -7] } : { rotate: 0 }}
        transition={tilt ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        {/* antenna */}
        <m.circle
          cx="12" cy="2.6" r="1.15" fill="currentColor"
          animate={
            mood === 'thinking' ? { opacity: [1, 0.35, 1] }
            : mood === 'excited' ? { y: [0, -1.3, 0] }
            : { opacity: 1, y: 0 }
          }
          transition={
            mood === 'thinking' ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
            : mood === 'excited' ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
            : undefined
          }
        />
        <line x1="12" y1="3.75" x2="12" y2="6.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        {/* ears */}
        <rect x="2.2" y="10.3" width="2.3" height="5" rx="1.15" fill="currentColor" />
        <rect x="19.5" y="10.3" width="2.3" height="5" rx="1.15" fill="currentColor" />
        {/* head */}
        <rect x="4.6" y="6.2" width="14.8" height="14" rx="5" stroke="currentColor" strokeWidth="1.7" />
        {/* eyes */}
        {mood === 'thinking' ? (
          <>
            <m.circle
              cy="13.1" r="1.55" fill="currentColor"
              animate={{ cx: [9.7, 10.3, 9.7] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
            />
            <m.circle
              cy="13.1" r="1.55" fill="currentColor"
              animate={{ cx: [14.3, 14.9, 14.3] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : mood === 'confused' ? (
          <>
            <circle cx="9.7" cy="13.5" r="1.4" fill="currentColor" style={eyeOrigin} transform="scale(1,0.6)" />
            <circle cx="14.3" cy="12.85" r="1.6" fill="currentColor" />
          </>
        ) : (
          <>
            <m.circle
              cx="9.7" cy="13.1" r={bigEyes ? 1.75 : 1.55} fill="currentColor"
              style={eyeOrigin}
              animate={{ scaleY: [1, 1, 0.12, 1] }}
              transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.92, 0.96, 1], ease: 'easeInOut' }}
            />
            <m.circle
              cx="14.3" cy="13.1" r={bigEyes ? 1.75 : 1.55} fill="currentColor"
              style={eyeOrigin}
              animate={{ scaleY: [1, 1, 0.12, 1] }}
              transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.92, 0.96, 1], ease: 'easeInOut' }}
            />
          </>
        )}
        {/* mouth */}
        {mood === 'thinking' ? (
          <line x1="9.8" y1="16.85" x2="14.2" y2="16.85" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : mood === 'confused' ? (
          <path d="M9.6 17.1q1.1-1 2.2 0t2.2 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        ) : mood === 'excited' ? (
          <path d="M8.7 16.1c1.4 1.7 5.2 1.7 6.6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : mood === 'happy' ? (
          <path d="M8.9 16.3c1.3 1.4 5 1.4 6.2 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        ) : (
          <path d="M9.3 16.6c1 .95 4.4.95 5.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </m.g>
    </svg>
  )
}

export function BotAvatar({ mood }: { mood: BotMood }) {
  return (
    <div
      className="w-6 h-6 flex items-center justify-center flex-shrink-0"
      style={{ background: 'var(--accent-gradient)' }}
      aria-hidden="true"
    >
      <BotIcon width={13} height={13} color="white" mood={mood} />
    </div>
  )
}
