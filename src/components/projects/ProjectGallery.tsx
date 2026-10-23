'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { fill, type GalleryLabels } from './gallery-text'
import { useSwipe } from './swipe'

// Opened by a click on the main picture; its code is fetched only then.
const ProjectLightbox = dynamic(() => import('./ProjectLightbox'), { ssr: false })

const arrowStyle = { background: 'rgba(0,0,0,0.6)', color: '#fff', width: 40, height: 40, border: '1px solid rgba(255,255,255,0.35)' } as const

// Detail page of a project with several pictures: the main one, thumbnails under
// it, arrows, swipe and keyboard. Only the main picture loads at once; the
// thumbnails are small (96 px wide) and lazy. A picture that fails to load is
// dropped from the list, and when none loads the `fallback` is shown instead.
export default function ProjectGallery({ images, title, labels, fallback }: { images: string[]; title: string; labels: GalleryLabels; fallback: ReactNode }) {
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
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (count < 2) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
  }

  return (
    <>
      <div role="group" aria-roledescription="carousel" aria-label={labels.label} onKeyDown={onKeyDown} data-testid="project-gallery">
        <div
          className="relative w-full rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', aspectRatio: '16/9', touchAction: 'pan-y' }}
          {...swipe}
        >
          <button
            ref={opener}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`${labels.open} — ${fill(labels.imageOf, current + 1, count)}`}
            aria-haspopup="dialog"
            data-testid="gallery-main"
            className="absolute inset-0 w-full h-full"
            style={{ cursor: 'zoom-in' }}
          >
            <Image key={src} src={src} alt={`${title} — ${fill(labels.imageOf, current + 1, count)}`} fill priority={current === 0} sizes="(min-width: 1024px) 800px, 100vw" className="object-contain" onError={() => markBroken(src)} />
          </button>

          {count > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={labels.previous} data-testid="gallery-prev" className="absolute flex items-center justify-center" style={{ ...arrowStyle, left: 8, top: '50%', transform: 'translateY(-50%)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button type="button" onClick={() => go(1)} aria-label={labels.next} data-testid="gallery-next" className="absolute flex items-center justify-center" style={{ ...arrowStyle, right: 8, top: '50%', transform: 'translateY(-50%)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <span aria-live="polite" data-testid="gallery-counter" className="absolute text-xs px-2 py-1" style={{ right: 8, bottom: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: 'var(--font-poppins)' }}>
                {current + 1} / {count}
              </span>
            </>
          )}
        </div>

        {count > 1 && (
          // width 0 + min-width 100%: the row scrolls inside the page's width instead of widening the page to fit six thumbnails
          <ul className="flex gap-2 mt-3 list-none p-0 overflow-x-auto" style={{ scrollbarWidth: 'thin', width: 0, minWidth: '100%' }}>
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
                      width: 96,
                      height: 60,
                      border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      opacity: selected ? 1 : 0.65,
                      background: 'var(--surface-hover)',
                    }}
                  >
                    <Image src={thumb} alt="" fill loading="lazy" sizes="96px" className="object-cover" onError={() => markBroken(thumb)} />
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
