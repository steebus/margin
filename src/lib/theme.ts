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

export type ThemeChoice = Theme | 'system'
let chosen: ThemeChoice | null = null

/** The reader's choice: light, dark, or whatever the system says. */
export function setTheme(theme: ThemeChoice) {
  chosen = theme
  override = theme === 'system' ? null : theme
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch { /* private window: it lasts until the page closes */ }
  listeners.forEach(listener => listener())
}

const currentChoice = (): ThemeChoice => {
  if (chosen) return chosen
  const saved = readSaved()
  return saved === 'light' || saved === 'dark' ? saved : 'system'
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

export const useThemeChoice = () => useSyncExternalStore(subscribe, currentChoice)
