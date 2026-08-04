'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const wrapStyle: React.CSSProperties = { overflowWrap: 'anywhere', wordBreak: 'break-word' }

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0" style={wrapStyle}>{children}</p>,
  strong: ({ children }) => <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-4 space-y-1" style={{ listStyle: 'disc', ...wrapStyle }}>{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-4 space-y-1" style={{ listStyle: 'decimal', ...wrapStyle }}>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', ...wrapStyle }}>
      {children}
    </a>
  ),
  // Fenced code blocks (```python ...) render as <pre><code>; this wrapper is
  // what actually keeps long/unbroken lines from blowing out the bubble width
  // on narrow screens — it scrolls horizontally instead of stretching the page.
  pre: ({ children }) => (
    <pre
      className="rounded-lg mt-1 mb-2"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: '0.65rem 0.75rem',
        overflowX: 'auto',
        maxWidth: '100%',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isBlock = /language-/.test(className ?? '') || String(children).includes('\n')
    if (isBlock) {
      return (
        <code className={className} style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre' }}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="text-xs rounded"
        style={{ background: 'var(--surface)', padding: '0.1rem 0.35rem', fontFamily: 'monospace', ...wrapStyle }}
      >
        {children}
      </code>
    )
  },
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded images, unknown aspect ratio
    <img
      src={typeof src === 'string' ? src : undefined}
      alt={alt ?? ''}
      loading="lazy"
      className="rounded-lg mt-1 mb-2"
      style={{ maxWidth: '100%', height: 'auto', border: '1px solid var(--border)' }}
    />
  ),
  // GFM tables (remark-gfm) don't wrap by nature — scope the horizontal
  // scroll to the table itself instead of letting it stretch the bubble.
  table: ({ children }) => (
    <div className="mb-2 last:mb-0" style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem' }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ border: '1px solid var(--border)', padding: '0.35rem 0.5rem', textAlign: 'left', whiteSpace: 'nowrap', color: 'var(--text)' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ border: '1px solid var(--border)', padding: '0.35rem 0.5rem', ...wrapStyle }}>
      {children}
    </td>
  ),
}

// react-markdown + remark-gfm pull in a sizeable AST/parser dependency tree —
// split out from ChatWidget's own chunk so it's only fetched once a message
// actually needs rendering, not the instant the (closed) chat bubble mounts
// on every page.
export default function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
