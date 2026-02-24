import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeStore {
  dark: boolean
  toggle: () => void
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set, get) => ({
      dark: false,
      toggle: () => {
        const next = !get().dark
        set({ dark: next })
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
      },
    }),
    { name: 'ims_theme_v1' }
  )
)

// Apply theme on load
export function initTheme() {
  const stored = localStorage.getItem('ims_theme_v1')
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      document.documentElement.setAttribute('data-theme', state?.dark ? 'dark' : 'light')
    } catch {}
  }
}
