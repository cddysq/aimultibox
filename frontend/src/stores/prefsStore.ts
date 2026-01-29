/**
 * 全局偏好 Store（主题 + 时区）
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface PrefsState {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  timezone: string
  locale: string
  setTheme: (theme: Theme) => void
  setTimezone: (tz: string) => void
  setLocale: (locale: string) => void
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  return theme === 'system' ? getSystemTheme() : theme
}

const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  const resolved = resolveTheme(theme)
  root.classList.remove('light', 'dark')
  if (resolved === 'dark') {
    root.classList.add('dark')
  }
}

const getDefaultTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

const getDefaultLocale = (): string => {
  return navigator.language || 'zh-CN'
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'system',
      resolvedTheme: getSystemTheme(),
      timezone: getDefaultTimezone(),
      locale: getDefaultLocale(),
      setTheme: (theme: Theme) => {
        const resolvedTheme = resolveTheme(theme)
        applyTheme(theme)
        set({ theme, resolvedTheme })
      },
      setTimezone: (tz) => set({ timezone: tz }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'aimultibox-prefs',
      onRehydrateStorage: () => (state, error) => {
        if (!error && state) {
          queueMicrotask(() => {
            applyTheme(state.theme)
            usePrefsStore.setState({ resolvedTheme: resolveTheme(state.theme) })
          })
        }
      },
    }
  )
)

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = usePrefsStore.getState()
    if (theme === 'system') {
      const resolved = getSystemTheme()
      applyTheme('system')
      usePrefsStore.setState({ resolvedTheme: resolved })
    }
  })
}
