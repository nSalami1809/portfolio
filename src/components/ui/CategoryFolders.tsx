'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import FadeIn from '@/components/animations/FadeIn'
import Icon from '@/components/ui/Icon'
import { countLabel, fanPose, groupFolders, MIN_FOLDERS, type Folder, type FolderItemData } from '@/lib/category-folders'
import type { Locale } from '@/lib/i18n/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { IconName } from '@/components/ui/Icon'

// The texts of a folder row: every section that has folders (projects, blog, documents) carries these six in its dictionary.
export type FolderTexts = Pick<Dictionary['projects'], 'foldersLabel' | 'foldersHint' | 'folderOne' | 'folderMany' | 'folderOpenAria' | 'folderSeeAll'>

interface Props {
  items: FolderItemData[]
  /** Where a card leads: /{locale}/{base}/{slug} */
  base: 'projects' | 'blog' | 'documents'
  /** Shown on a card that has no picture */
  emptyIcon?: IconName
  locale: Locale
  t: FolderTexts
  /** "See the category": the list below is filtered on it */
  onSeeCategory: (category: string) => void
}

// One folder per category, above the list (projects, blog and documents share it). Flat and square like the rest of the site. The folder is drawn by the server
// (closed), so it is on screen before any JavaScript runs. It opens on mouse hover, on a tap, or with the keyboard, and
// the cards that come out are links to the items themselves.
// Weight: no library, only CSS transforms; and the pictures of the cards are NOT requested until the folder is opened
// for the first time, so a visitor who never opens one downloads none of them.
function FolderItem({ folder, base, emptyIcon, locale, t, onSeeCategory }: { folder: Folder } & Omit<Props, 'items'>) {
  const [open, setOpen] = useState(false)
  const [pictures, setPictures] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const panel = useId()

  const show = (next: boolean) => {
    if (next) setPictures(true)
    setOpen(next)
  }

  // An open folder closes with Escape, or with a tap/click anywhere else (a mouse also closes it by leaving)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus() } }
    const onDown = (e: PointerEvent) => { if (root.current && e.target instanceof Node && !root.current.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open])

  const count = countLabel(folder.count, t.folderOne, t.folderMany)

  return (
    <div
      ref={root}
      className="folder"
      data-open={open ? '' : undefined}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') show(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false) }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false) }}
    >
      <div className="folder-stage">
        <span className="folder-back" aria-hidden="true" />
        <span className="folder-tab" aria-hidden="true" />
        {/* After the button in the page, so Tab goes from the folder to its cards; the stacking is done by z-index */}
        <button
          ref={toggle}
          type="button"
          className="folder-front"
          aria-expanded={open}
          aria-controls={panel}
          aria-label={t.folderOpenAria.replace('{name}', folder.category)}
          onClick={() => show(!open)}
        >
          <span className="folder-name">{folder.category}</span>
          <span className="folder-count">{count}</span>
        </button>
        <div id={panel} className="folder-fan" inert={!open}>
          {folder.covers.map((p, i) => {
            const pose = fanPose(i, folder.covers.length)
            return (
              <Link
                key={p.slug}
                href={`/${locale}/${base}/${p.slug}`}
                className="folder-card"
                style={{ '--x': pose.x, '--y': pose.y, '--r': `${pose.r}deg`, '--d': `${i * 60}ms` } as React.CSSProperties}
              >
                {pictures && p.image ? (
                  <Image src={p.image} alt="" fill sizes="96px" loading="eager" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
                ) : (
                  <span className="folder-card-empty" aria-hidden="true"><Icon name={emptyIcon ?? 'layers'} size={18} /></span>
                )}
                <span className="folder-card-title">{p.title}</span>
              </Link>
            )
          })}
        </div>
      </div>
      <button type="button" className="folder-see" onClick={() => onSeeCategory(folder.category)}>
        {t.folderSeeAll}
        <Icon name="arrowRight" size={12} />
      </button>
    </div>
  )
}

export default function CategoryFolders({ items, base, emptyIcon, locale, t, onSeeCategory }: Props) {
  const folders = groupFolders(items)
  if (folders.length < MIN_FOLDERS) return null

  return (
    <FadeIn>
      <section className="mb-14" aria-labelledby={`${base}-folders-title`}>
        <p id={`${base}-folders-title`} className="section-label mb-2">{t.foldersLabel}</p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-subtle)' }}>{t.foldersHint}</p>
        <div className="folders">
          {folders.map((folder) => (
            <FolderItem key={folder.category} folder={folder} base={base} emptyIcon={emptyIcon} locale={locale} t={t} onSeeCategory={onSeeCategory} />
          ))}
        </div>
      </section>
    </FadeIn>
  )
}
