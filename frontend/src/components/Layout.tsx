/**
 * 全局布局
 */
import { Outlet, Link } from 'react-router'
import { Box, Github, Menu, X, Sun, Moon, Monitor, Languages, GitBranch } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores'
import { SUPPORTED_LANGS } from '@/locales'
import LanguageSuggestionBanner from './LanguageSuggestionBanner'

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const { theme, setTheme, resolvedTheme } = useThemeStore()
  const { t, i18n } = useTranslation()
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false)
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const themeOptions = [
    { id: 'light' as const, name: t('layout.theme.light'), icon: Sun },
    { id: 'dark' as const, name: t('layout.theme.dark'), icon: Moon },
    { id: 'system' as const, name: t('layout.theme.system'), icon: Monitor },
  ]

  const langOptions = SUPPORTED_LANGS.map(id => ({
    id,
    name: t(`langSuggestion.langs.${id}`),
  }))

  const CurrentThemeIcon = resolvedTheme === 'dark' ? Moon : Sun

  return (
    <>
      {/* 语言建议横幅 - 基于 IP 地理位置检测 */}
      <LanguageSuggestionBanner />

      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors flex flex-col">
      {/* 导航栏 */}
      <nav className="bg-white dark:bg-slate-800 shadow-sm border-b border-gray-100 dark:border-slate-700 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Box className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">AIMultiBox</span>
              </Link>
            </div>

            {/* 桌面端导航 */}
            <div className="hidden md:flex items-center space-x-2">
              {/* 语言切换 */}
              <div className="relative" ref={langMenuRef}>
                <button
                  onClick={() => setLangMenuOpen(!langMenuOpen)}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center space-x-1"
                >
                  <Languages className="w-5 h-5" />
                  <span className="text-sm">{t(`langSuggestion.langShort.${i18n.language}`)}</span>
                </button>
                
                {langMenuOpen && (
                  <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50">
                    {langOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          i18n.changeLanguage(option.id)
                          setLangMenuOpen(false)
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                          i18n.language === option.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 主题切换 */}
              <div className="relative" ref={themeMenuRef}>
                <button
                  onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <CurrentThemeIcon className="w-5 h-5" />
                </button>
                
                {themeMenuOpen && (
                  <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50">
                    {themeOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setTheme(option.id)
                          setThemeMenuOpen(false)
                        }}
                        className={`w-full px-4 py-2 text-left flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                          theme === option.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <option.icon className="w-4 h-4" />
                        <span>{option.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <a 
                href="https://github.com/cddysq/aimultibox" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>

            {/* 移动端按钮 */}
            <div className="md:hidden flex items-center space-x-1">
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="p-2 text-gray-600 dark:text-gray-300"
              >
                <Languages className="w-5 h-5" />
              </button>
              <button
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="p-2 text-gray-600 dark:text-gray-300"
              >
                <CurrentThemeIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-600 dark:text-gray-300"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
            <div className="px-4 py-3 space-y-2">
              <Link 
                to="/" 
                className="block px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('layout.toolbox')}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Outlet />
      </main>

      {/* 页脚 */}
      <footer className="bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 mt-auto transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <Link 
              to="/" 
              className="text-gray-500 dark:text-gray-400 text-sm hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              © 2025 AIMultiBox
            </Link>
            <div className="flex items-center space-x-4">
              <Link 
                to="/changelog" 
                className="text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 text-sm flex items-center space-x-1 transition-colors"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>{t('layout.changelog')}</span>
              </Link>
              <a 
                href="https://github.com/cddysq/aimultibox" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  )
}
