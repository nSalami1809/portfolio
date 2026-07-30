'use client'

import dynamic from 'next/dynamic'

// The chat widget (react-markdown, remark-gfm, AI SDK client) is sizeable and
// only matters once a visitor actually opens it — keep it out of the shared
// layout bundle that every single page currently pays for.
const ChatWidget = dynamic(() => import('./ChatWidget'), { ssr: false })

export default function ChatWidgetLoader() {
  return <ChatWidget />
}
