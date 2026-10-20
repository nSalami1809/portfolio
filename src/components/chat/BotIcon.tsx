'use client'

// NemCopilotIA's mark, shared by the public chat and the back-office assistant: Hugeicons'
// "ChatBot" robot (the owner's pick), drawn in the current text colour. It always sits on a
// square (the avatars, the header badge, the floating button), so the site's square design
// holds. The mood only moves the icon; the drawing never changes.
import { m } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChatBotIcon } from '@hugeicons/core-free-icons'

export type BotMood = 'idle' | 'thinking' | 'happy' | 'excited' | 'confused'

export const BOT_STROKE_WIDTH = 1.5

export function BotIcon({ mood = 'idle', width, height, ...rest }: React.SVGProps<SVGSVGElement> & { mood?: BotMood }) {
  const size = Number(width ?? height ?? 24)
  const hidden = rest['aria-hidden']
  return (
    <m.span
      style={{ display: 'inline-flex', lineHeight: 0 }}
      animate={
        mood === 'thinking' ? { opacity: [1, 0.45, 1] }
        : mood === 'excited' ? { y: [0, -1.5, 0] }
        : mood === 'confused' ? { rotate: [-6, 6, -6] }
        : mood === 'happy' ? { scale: 1.08, opacity: 1, y: 0, rotate: 0 }
        : { scale: 1, opacity: 1, y: 0, rotate: 0 }
      }
      transition={
        mood === 'thinking' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
        : mood === 'excited' ? { duration: 0.55, repeat: Infinity, ease: 'easeInOut' }
        : mood === 'confused' ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
        : { duration: 0.2 }
      }
    >
      <HugeiconsIcon icon={ChatBotIcon} size={size} color="currentColor" strokeWidth={BOT_STROKE_WIDTH} aria-hidden={hidden === undefined ? true : hidden} />
    </m.span>
  )
}

export function BotAvatar({ mood }: { mood: BotMood }) {
  return (
    <div
      className="w-6 h-6 flex items-center justify-center flex-shrink-0"
      style={{ background: 'var(--brand, var(--accent))', color: 'var(--brand-contrast, var(--accent-contrast))' }}
      aria-hidden="true"
    >
      <BotIcon width={16} height={16} mood={mood} />
    </div>
  )
}
