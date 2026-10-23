'use client'

import { useState, type ReactNode } from 'react'
import ProjectGallery, { type GalleryView } from './ProjectGallery'
import type { GalleryLabels } from './gallery-text'

// The pictures of a project in up to two views, desktop and phone, each with its own
// gallery. With only one of them there is no switch at all. Only the view being shown
// is on the page: the other one loads nothing until it is chosen.
export default function ProjectMedia({ desktop, mobile, title, labels, fallback }: { desktop: string[]; mobile: string[]; title: string; labels: GalleryLabels; fallback: ReactNode }) {
  const views: GalleryView[] = [...(desktop.length ? (['desktop'] as const) : []), ...(mobile.length ? (['mobile'] as const) : [])]
  const [chosen, setChosen] = useState<GalleryView>(views[0] ?? 'desktop')
  const view = views.includes(chosen) ? chosen : (views[0] ?? 'desktop')
  const images = { desktop, mobile }

  if (views.length < 2) return <ProjectGallery view={view} images={images[view]} title={title} labels={labels} fallback={fallback} />

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = views[(views.indexOf(view) + (e.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length]
    setChosen(next)
    requestAnimationFrame(() => document.getElementById(`project-view-tab-${next}`)?.focus())
  }

  return (
    <div data-testid="project-media">
      <div role="tablist" aria-label={labels.views} onKeyDown={onKeyDown} className="flex gap-2 mb-3">
        {views.map((v) => {
          const selected = v === view
          return (
            <button
              key={v}
              type="button"
              role="tab"
              id={`project-view-tab-${v}`}
              aria-selected={selected}
              aria-controls="project-view-panel"
              tabIndex={selected ? 0 : -1}
              data-testid={`view-tab-${v}`}
              onClick={() => setChosen(v)}
              className="text-sm font-medium px-4 py-2"
              style={{
                background: selected ? 'var(--accent)' : 'transparent',
                color: selected ? 'var(--accent-contrast)' : 'var(--text-muted)',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                fontFamily: 'var(--font-poppins)',
              }}
            >
              {labels[v]} <span style={{ opacity: 0.7 }}>({images[v].length})</span>
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id="project-view-panel" aria-labelledby={`project-view-tab-${view}`}>
        <ProjectGallery key={view} view={view} images={images[view]} title={title} labels={labels} fallback={fallback} />
      </div>
    </div>
  )
}
