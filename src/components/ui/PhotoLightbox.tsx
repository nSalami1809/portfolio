'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image, { getImageProps } from 'next/image'
import Icon from '@/components/ui/Icon'

interface Props {
  src: string
  alt: string
  openLabel: string
  closeLabel: string
  /** Size of the small round picture, in px */
  size?: number
}

const BIG = 640
const BIG_SIZES = '(max-width: 640px) 80vw, 420px'
const DURATION = 300
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Where the middle of `a` has to go, and by how much it has to shrink or grow, to sit exactly on `b` */
function flip(a: DOMRect, b: DOMRect) {
  return `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(${b.width / a.width})`
}

/**
 * A round profile picture that opens large when tapped, the way Instagram, Facebook and Snapchat do it: the picture grows
 * out of its place on the page over a dark, blurred backdrop, and shrinks back into it when closed (tap anywhere, the cross,
 * or Escape). The big version is only downloaded when the reader shows interest (hover, focus, touch), never on page load.
 */
export default function PhotoLightbox({ src, alt, openLabel, closeLabel, size = 80 }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const closing = useRef(false)
  const warmed = useRef(false)
  const restoreFocus = useRef(false)

  useEffect(() => {
    if (open || !restoreFocus.current) return
    restoreFocus.current = false
    triggerRef.current?.focus({ preventScroll: true })
  }, [open])

  // Starts the download of the big picture (same URL the dialog will ask for, so the browser reuses it)
  const warm = useCallback(() => {
    if (warmed.current) return
    warmed.current = true
    const { props } = getImageProps({ src, alt, width: BIG, height: BIG, sizes: BIG_SIZES })
    const img = new window.Image()
    img.sizes = BIG_SIZES
    if (props.srcSet) img.srcset = props.srcSet
    img.src = props.src
  }, [src, alt])

  const close = useCallback(() => {
    const trigger = triggerRef.current
    const photo = photoRef.current
    const backdrop = backdropRef.current
    if (closing.current) return
    closing.current = true
    const done = () => {
      closing.current = false
      restoreFocus.current = true // the small picture is still hidden: it gets the focus once it is shown again (effect below)
      setOpen(false)
    }
    if (!trigger || !photo || !backdrop || reducedMotion()) return done()
    photo.style.transform = flip(photo.getBoundingClientRect(), trigger.getBoundingClientRect())
    backdrop.style.opacity = '0'
    window.setTimeout(done, DURATION - 20)
  }, [])

  // Opening: the picture starts exactly on top of the small one, then grows to the middle of the screen
  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const photo = photoRef.current
    const backdrop = backdropRef.current
    if (trigger && photo && backdrop && !reducedMotion()) {
      photo.style.transition = 'none'
      backdrop.style.transition = 'none'
      photo.style.transform = flip(photo.getBoundingClientRect(), trigger.getBoundingClientRect())
      backdrop.style.opacity = '0'
      void photo.offsetWidth // lets the browser take the starting position into account
      photo.style.transition = `transform ${DURATION}ms ${EASE}`
      backdrop.style.transition = `opacity ${DURATION}ms ease`
      photo.style.transform = 'none'
      backdrop.style.opacity = '1'
    }
    closeBtnRef.current?.focus({ preventScroll: true })

    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'
    return () => { html.style.overflow = previous }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close() }
      // the cross is the only thing to reach with the keyboard: keep the focus on it
      if (e.key === 'Tab') { e.preventDefault(); closeBtnRef.current?.focus({ preventScroll: true }) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-label={openLabel}
        onClick={() => setOpen(true)}
        onPointerEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
        className="block rounded-full"
        style={{ width: size, height: size, cursor: 'zoom-in', visibility: open ? 'hidden' : undefined }}
      >
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          priority
          className="rounded-full object-cover"
          style={{ width: size, height: size, border: '2px solid var(--accent)', boxShadow: '0 0 0 4px var(--accent-glow)' }}
        />
      </button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          onClick={close}
        >
          <div
            ref={backdropRef}
            className="absolute inset-0"
            style={{ background: 'rgba(0, 0, 0, 0.88)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            aria-hidden="true"
          />
          <button
            ref={closeBtnRef}
            type="button"
            aria-label={closeLabel}
            onClick={(e) => { e.stopPropagation(); close() }}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: 'rgba(255, 255, 255, 0.14)', color: '#fff' }}
          >
            <Icon name="close" size={20} />
          </button>
          <div
            ref={photoRef}
            className="relative aspect-square overflow-hidden rounded-full"
            style={{
              width: 'min(80vw, 80svh, 420px)',
              background: 'var(--surface)',
              border: '3px solid var(--accent)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              willChange: 'transform',
            }}
          >
            <Image src={src} alt={alt} width={BIG} height={BIG} sizes={BIG_SIZES} className="h-full w-full object-cover" />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
