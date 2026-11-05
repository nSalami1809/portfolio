import { useCallback } from 'react'

/**
 * "See the category" of a folder: the page scrolls to the list FIRST, while it is still, and the list is filtered once the
 * page has arrived. Filtering while the page scrolls moves the target under it (the page shrinks and the cards move),
 * and the scroll ended back at the top.
 *
 * `listId` is the id of an element placed just above the list; `active` / `setActive` are the list's current filter.
 */
export function useSeeCategory(listId: string, active: string, setActive: (category: string) => void) {
  return useCallback((category: string) => {
    const list = document.getElementById(listId)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const apply = () => { if (category !== active) setActive(category) }
    if (!list || reduce || Math.abs(list.getBoundingClientRect().top - 96) < 4) {
      list?.scrollIntoView({ behavior: 'auto', block: 'start' })
      apply()
      return
    }
    let done = false
    const arrived = () => {
      if (done) return
      done = true
      window.removeEventListener('scrollend', arrived)
      apply()
    }
    window.addEventListener('scrollend', arrived, { once: true })
    window.setTimeout(arrived, 1200) // browsers without "scrollend", or a scroll that was interrupted
    list.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [listId, active, setActive])
}
