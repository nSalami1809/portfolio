'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { pictureFit } from '@/lib/project-gallery'

type Props = Omit<ImageProps, 'fill' | 'className' | 'style' | 'width' | 'height'> & {
  /** 'cover': always fill the frame from the top (browser and phone views). Default: decided by the picture's own proportions. */
  fit?: 'cover' | 'adaptive'
}

// A project picture inside a positioned frame. The frame is filled edge to edge, so there are
// no empty bands at the sides. A picture that is not a screenshot stays whole, over a blurred copy
// of itself (same URL and sizes, so it is downloaded once).
// The server and the first paint use "cover"; the real proportions are known once it loads.
export default function ProjectPicture({ fit = 'adaptive', onLoad, ...props }: Props) {
  const [measured, setMeasured] = useState<'cover' | 'contain'>('cover')
  const mode = fit === 'cover' ? 'cover' : measured
  return (
    <>
      {mode === 'contain' && (
        <Image src={props.src} alt="" aria-hidden="true" fill sizes={props.sizes} style={{ objectFit: 'cover', filter: 'blur(30px) saturate(1.3)', transform: 'scale(1.35)', opacity: 0.9 }} />
      )}
      <Image
        {...props}
        alt={props.alt}
        fill
        onLoad={(e) => {
          const img = e.currentTarget
          if (fit === 'adaptive') setMeasured(pictureFit(img.naturalWidth, img.naturalHeight))
          onLoad?.(e)
        }}
        style={{ objectFit: mode, objectPosition: mode === 'cover' ? 'top center' : 'center' }}
      />
    </>
  )
}
