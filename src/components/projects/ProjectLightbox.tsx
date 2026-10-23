'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useSwipe } from './swipe'
import { fill, type GalleryLabels } from './gallery-text'
import Icon from '@/components/ui/Icon'

const controlStyle = { background: 'rgba(0,0,0,0.6)', color: '#fff', width: 44, height: 44, border: '1px solid rgba(255,255,255,0.35)' } as const

// The enlarged picture. Loaded only when a visitor opens it (next/dynamic in
// ProjectGallery), so the page ships none of this code to the others.
// Closes with the button, Escape or a click outside the controls; keeps the
// keyboard focus inside while open; the page behind does not scroll.
export default function ProjectLightbox({ images, index, onIndex, onClose, onBroken, labels, title }: {
  images: string[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  onBroken: (src: string) => void
  labels: GalleryLabels
  title: string
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const count = images.length
  const go = (delta: number) => onIndex((index + delta + count) % count)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowLeft' && count > 1) { e.preventDefault(); go(-1) }
      else if (e.key === 'ArrowRight' && count > 1) { e.preventDefault(); go(1) }
      else if (e.key === 'Tab') {
        const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button') ?? [])
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go() only reads index/count, re-bound each render below
  }, [index, count, onClose])

  const swipe = useSwipe(() => count > 1 && go(1), () => count > 1 && go(-1))
  const src = images[index]
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — ${labels.label}`}
      data-testid="gallery-lightbox"
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 200, background: 'rgba(0,0,0,0.96)', touchAction: 'pan-y' }}
      onClick={onClose}
      {...swipe}
    >
      <div className="absolute inset-0" style={{ padding: '56px 16px' }}>
        <div className="relative w-full h-full">
          <Image key={src} src={src} alt={`${title} — ${fill(labels.imageOf, index + 1, count)}`} fill sizes="100vw" priority className="object-contain" onError={() => onBroken(src)} />
        </div>
      </div>

      <button ref={closeRef} type="button" onClick={(e) => { stop(e); onClose() }} aria-label={labels.close} data-testid="gallery-close" className="absolute flex items-center justify-center" style={{ ...controlStyle, top: 8, right: 8 }}>
        <Icon name="close" size={18} />
      </button>

      {count > 1 && (
        <>
          <button type="button" onClick={(e) => { stop(e); go(-1) }} aria-label={labels.previous} data-testid="gallery-lightbox-prev" className="absolute flex items-center justify-center" style={{ ...controlStyle, left: 8, top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" onClick={(e) => { stop(e); go(1) }} aria-label={labels.next} data-testid="gallery-lightbox-next" className="absolute flex items-center justify-center" style={{ ...controlStyle, right: 8, top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="chevronRight" size={18} />
          </button>
          <p aria-live="polite" className="absolute text-sm" style={{ bottom: 16, left: 0, right: 0, textAlign: 'center', color: '#fff', fontFamily: 'var(--font-poppins)' }}>
            {fill(labels.imageOf, index + 1, count)}
          </p>
        </>
      )}
    </div>,
    document.body,
  )
}
