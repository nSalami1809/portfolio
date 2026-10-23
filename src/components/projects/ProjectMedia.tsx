'use client'

import { useState, type ReactNode } from 'react'
import ProjectGallery, { type GalleryView } from './ProjectGallery'
import type { GalleryLabels } from './gallery-text'

// The pictures of a project in up to two views, desktop and phone, each with its own
// gallery. With only one of them there is no switch at all. Only the view being shown
// is on the page: the other one loads nothing until it is chosen.
const iconProps = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const MonitorIcon = () => <svg {...iconProps}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
const PhoneIcon = () => <svg {...iconProps}><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></svg>

export default function ProjectMedia({ desktop, mobile, title, labels, fallback, address }: { desktop: string[]; mobile: string[]; title: string; labels: GalleryLabels; fallback: ReactNode; address?: string }) {
  const views: GalleryView[] = [...(desktop.length ? (['desktop'] as const) : []), ...(mobile.length ? (['mobile'] as const) : [])]
  const [chosen, setChosen] = useState<GalleryView>(views[0] ?? 'desktop')
  const view = views.includes(chosen) ? chosen : (views[0] ?? 'desktop')
  const images = { desktop, mobile }

  if (views.length < 2) return <ProjectGallery view={view} images={images[view]} title={title} labels={labels} fallback={fallback} address={address} />

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = views[(views.indexOf(view) + (e.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length]
    setChosen(next)
    requestAnimationFrame(() => document.getElementById(`project-view-tab-${next}`)?.focus())
  }

  return (
    <div data-testid="project-media">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <span id="project-view-caption" className="section-label">{labels.viewApp}</span>
        <div role="tablist" aria-labelledby="project-view-caption" onKeyDown={onKeyDown} className="inline-flex" data-testid="view-tabs">
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
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5"
              style={{
                background: selected ? 'var(--accent)' : 'var(--surface)',
                color: selected ? 'var(--accent-contrast)' : 'var(--text-muted)',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                marginLeft: v === views[0] ? 0 : -1,
                position: 'relative',
                zIndex: selected ? 1 : 0,
                fontFamily: 'var(--font-poppins)',
              }}
            >
              {v === 'desktop' ? <MonitorIcon /> : <PhoneIcon />}
              {labels[v]}
            </button>
          )
        })}
        </div>
      </div>
      <div role="tabpanel" id="project-view-panel" aria-labelledby={`project-view-tab-${view}`}>
        <ProjectGallery key={view} view={view} images={images[view]} title={title} labels={labels} fallback={fallback} address={address} />
      </div>
    </div>
  )
}
