'use client'

import { useEffect, useRef } from 'react'
import { renderAsync } from 'docx-preview'

interface Props {
  fileUrl: string
  onError: () => void
}

// Renders the .docx entirely client-side (parses the zip/XML and produces
// HTML/CSS) — the file never leaves the visitor's browser, no server
// conversion or third-party service involved.
export default function DocxPreview({ fileUrl, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return

    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed')
        return res.blob()
      })
      .then((blob) => {
        if (cancelled || !container) return
        return renderAsync(blob, container, undefined, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: true,
          className: 'docx-preview',
        })
      })
      .catch(() => { if (!cancelled) onError() })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl])

  return (
    <div className="w-full overflow-auto" style={{ maxHeight: '80vh' }}>
      <div ref={containerRef} />
    </div>
  )
}
