'use client'

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
const STORAGE_KEY = 'theme'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  // Every card, button and tag has its own colour transition: switching the theme made dozens of them start at
  // once, which is what made the switch feel heavy. CSS transitions are frozen for the instant of the switch
  // (see `.theme-switching` in globals.css) and restored two frames later, so the page flips at once.
  root.classList.add('theme-switching')
  root.classList.toggle('dark', theme === 'dark')
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
}

// The <html> class is already set correctly before paint by the inline
// script in the root layout (see layout.tsx) — this hook's initial 'dark'
// state only drives the toggle button's own icon for the first render and
// is corrected in the effect below, so it never causes a flash on the page
// itself, only a possible one-frame mismatch on the switch icon.
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      setThemeState(stored) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }

    // No explicit choice saved yet — follow the OS/browser preference, and
    // keep following it live if the visitor switches their system theme
    // while the page is open.
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const syncWithSystem = () => {
      const next: Theme = mql.matches ? 'dark' : 'light'
      setThemeState(next)
      applyTheme(next)
    }
    syncWithSystem()
    mql.addEventListener('change', syncWithSystem)
    return () => mql.removeEventListener('change', syncWithSystem)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, toggle }
}
