'use client'

import dynamic from 'next/dynamic'
import type { Dictionary } from '@/lib/i18n/dictionaries'

// CodeMirror + the VS Code theme + JS language support are only needed on
// this one page — keep them out of every other route's bundle, same pattern
// as ChatWidgetLoader for the chat widget.
const CodePlayground = dynamic(() => import('./CodePlayground'), {
  ssr: false,
  loading: () => (
    <div className="card overflow-hidden animate-pulse" style={{ minHeight: 420 }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <div className="h-2.5 w-24" style={{ background: 'var(--surface-hover)' }} />
      </div>
      <div className="p-4 space-y-2">
        <div className="h-3 w-3/4" style={{ background: 'var(--surface-hover)' }} />
        <div className="h-3 w-1/2" style={{ background: 'var(--surface-hover)' }} />
        <div className="h-3 w-2/3" style={{ background: 'var(--surface-hover)' }} />
      </div>
    </div>
  ),
})

export default function CodePlaygroundLoader({ t }: { t: Dictionary['playground'] }) {
  return <CodePlayground t={t} />
}
