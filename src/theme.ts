import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'margin.theme'
const system = () => matchMedia('(prefers-color-scheme: dark)')

/** A saved choice wins. With no valid choice saved, the system setting decides. */
export function resolveTheme(saved: string | null, systemDark: boolean): Theme {
  if (saved === 'light' || saved === 'dark') return saved
  return systemDark ? 'dark' : 'light'
}

const readSaved = () => {
  try { return localStorage.getItem(KEY) } catch { return null }
}

const listeners = new Set<() => void>()
const current = () => resolveTheme(readSaved(), system().matches)

let override: Theme | null = null

export function setTheme(theme: Theme) {
  override = theme
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(KEY, theme) } catch { /* private window: it lasts until the page closes */ }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const media = system()
  media.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', listener)
  }
}

export const useTheme = () => useSyncExternalStore(subscribe, () => override ?? current())
