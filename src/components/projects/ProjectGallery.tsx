'use client'

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { fill, type GalleryLabels } from './gallery-text'
import { BrowserWindow, IPhone } from './DeviceFrames'
import ProjectPicture from './ProjectPicture'
import { useSwipe } from './swipe'

// Opened by a click on the main picture; its code is fetched only then.
const ProjectLightbox = dynamic(() => import('./ProjectLightbox'), { ssr: false })

// Desktop pictures sit in a browser window, phone screenshots in a phone, both on a quiet stage.
const VIEW = {
  desktop: { sizes: '(min-width: 1024px) 760px, 100vw', thumb: { width: 96, height: 56 }, thumbSizes: '96px' },
  mobile: { sizes: '(min-width: 640px) 300px, 80vw', thumb: { width: 54, height: 96 }, thumbSizes: '54px' },
} as const
export type GalleryView = keyof typeof VIEW

const arrowStyle: CSSProperties = { background: 'rgba(15,23,42,0.72)', color: '#fff', width: 40, height: 40, border: '1px solid rgba(255,255,255,0.3)' }

const Chevron = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

// Detail page of a project with several pictures: the main one in its device, thumbnails
// under it, arrows, swipe and keyboard. Only the main picture loads at once; the thumbnails
// are small and lazy. A picture that fails to load is dropped from the list, and when none
// loads the `fallback` is shown instead.
export default function ProjectGallery({ images, title, labels, fallback, view = 'desktop', address }: { images: string[]; title: string; labels: GalleryLabels; fallback: ReactNode; view?: GalleryView; address?: string }) {
  const v = VIEW[view]
  const [index, setIndex] = useState(0)
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set())
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)

  const shown = images.filter((src) => !broken.has(src))
  const count = shown.length
  const current = Math.min(index, Math.max(0, count - 1))
  const go = useCallback((delta: number) => setIndex((i) => (count ? (Math.min(i, count - 1) + delta + count) % count : 0)), [count])
  const markBroken = useCallback((src: string) => setBroken((prev) => new Set(prev).add(src)), [])
  const swipe = useSwipe(() => count > 1 && go(1), () => count > 1 && go(-1))

  const close = useCallback(() => {
    setOpen(false)
    // back to the picture that opened it, so the keyboard user does not lose their place
    requestAnimationFrame(() => opener.current?.focus())
  }, [])

  if (count === 0) return <>{fallback}</>

  const src = shown[current]
  const label = fill(labels.imageOf, current + 1, count)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (count < 2) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
  }

  // The picture itself, as a button that opens it full screen.
  const main = (
    <button
      ref={opener}
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`${labels.open} — ${label}`}
      aria-haspopup="dialog"
      data-testid="gallery-main"
      className="absolute inset-0 w-full h-full"
      style={{ cursor: 'zoom-in' }}
    >
      <ProjectPicture key={src} src={src} alt={`${title} — ${label}`} fit="cover" priority={current === 0} sizes={v.sizes} onError={() => markBroken(src)} />
    </button>
  )

  const arrows = (side: { prev: CSSProperties; next: CSSProperties }) => count > 1 && (
    <>
      <button type="button" onClick={() => go(-1)} aria-label={labels.previous} data-testid="gallery-prev" className="absolute flex items-center justify-center" style={{ ...arrowStyle, top: '50%', transform: 'translateY(-50%)', ...side.prev }}>
        <Chevron d="M15 18l-6-6 6-6" />
      </button>
      <button type="button" onClick={() => go(1)} aria-label={labels.next} data-testid="gallery-next" className="absolute flex items-center justify-center" style={{ ...arrowStyle, top: '50%', transform: 'translateY(-50%)', ...side.next }}>
        <Chevron d="M9 18l6-6-6-6" />
      </button>
    </>
  )

  const counter = (style: CSSProperties) => count > 1 && (
    <span aria-live="polite" data-testid="gallery-counter" className="text-xs px-2 py-1" style={{ background: 'rgba(15,23,42,0.72)', color: '#fff', fontFamily: 'var(--font-poppins)', ...style }}>
      {current + 1} / {count}
    </span>
  )

  return (
    <>
      <div role="group" aria-roledescription="carousel" aria-label={labels.label} onKeyDown={onKeyDown} data-testid="project-gallery" data-view={view}>
        <div
          data-testid="gallery-stage"
          className="relative"
          style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: 'clamp(12px, 3.5vw, 32px)', touchAction: 'pan-y' }}
          {...swipe}
        >
          {view === 'desktop' ? (
            <BrowserWindow address={address ?? title}>
              <div className="relative" style={{ aspectRatio: '7/4', background: '#fff' }}>
                {main}
                {arrows({ prev: { left: 8 }, next: { right: 8 } })}
                {counter({ position: 'absolute', right: 8, bottom: 8 })}
              </div>
            </BrowserWindow>
          ) : (
            <IPhone>{main}</IPhone>
          )}

          {view === 'mobile' && arrows({ prev: { left: 8 }, next: { right: 8 } })}
          {view === 'mobile' && count > 1 && <div className="flex justify-center mt-4">{counter({})}</div>}
        </div>

        {count > 1 && (
          // width 0 + min-width 100%: the row scrolls inside the page's width instead of widening the page to fit six thumbnails
          <ul className="flex gap-2 mt-3 list-none p-0 overflow-x-auto" style={{ scrollbarWidth: 'thin', width: 0, minWidth: '100%', justifyContent: view === 'mobile' ? 'safe center' : undefined }}>
            {shown.map((thumb, i) => {
              const selected = i === current
              return (
                <li key={thumb} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={fill(labels.showImage, i + 1, count)}
                    aria-current={selected ? 'true' : undefined}
                    data-testid="gallery-thumb"
                    className="relative block overflow-hidden"
                    style={{
                      width: v.thumb.width,
                      height: v.thumb.height,
                      border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      opacity: selected ? 1 : 0.65,
                      background: 'var(--surface-hover)',
                    }}
                  >
                    <Image src={thumb} alt="" fill loading="lazy" sizes={v.thumbSizes} style={{ objectFit: 'cover', objectPosition: 'top center' }} onError={() => markBroken(thumb)} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {open && <ProjectLightbox images={shown} index={current} onIndex={setIndex} onClose={close} onBroken={markBroken} labels={labels} title={title} />}
    </>
  )
}
