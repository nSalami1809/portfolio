'use client'

import { useEffect } from 'react'
import { setPageHint, type ChatPageHint as Hint } from '@/lib/chat-page-context'

// Tells the chat which project or article the visitor is reading, so it can offer to talk
// about it. Renders nothing; the title is forgotten when the visitor leaves the page.
export default function ChatPageHint({ kind, title }: Hint) {
  useEffect(() => {
    setPageHint({ kind, title })
    return () => setPageHint(null)
  }, [kind, title])
  return null
}
