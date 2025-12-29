/**
 * 主题状态管理
 *
 * Tailwind CSS 4 现代暗色模式实现：
 * - system: 不添加任何类，让 CSS 跟随 prefers-color-scheme
 * - light: 添加 .light 类，强制亮色
 * - dark: 添加 .dark 类，强制暗色
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

/** 获取系统主题 */
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 解析实际主题 */
const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  return theme === 'system' ? getSystemTheme() : theme
}

/**
 * 应用主题到 DOM
 * Tailwind CSS 4 使用 .dark 类来触发 dark: 变体
 */
const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  const resolved = resolveTheme(theme)

  root.classList.remove('light', 'dark')
  if (resolved === 'dark') {
    root.classList.add('dark')
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      resolvedTheme: getSystemTheme(),
      setTheme: (theme: Theme) => {
        const resolvedTheme = resolveTheme(theme)
        applyTheme(theme)
        set({ theme, resolvedTheme })
      },
    }),
    {
      name: 'aimultibox-theme',
      onRehydrateStorage: () => (state, error) => {
        if (!error && state) {
          queueMicrotask(() => {
            applyTheme(state.theme)
            useThemeStore.setState({ resolvedTheme: resolveTheme(state.theme) })
          })
        }
      },
    }
  )
)

// 监听系统主题变化
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useThemeStore.getState()
    if (theme === 'system') {
      const resolved = getSystemTheme()
      applyTheme('system')
      useThemeStore.setState({ resolvedTheme: resolved })
    }
  })
}
