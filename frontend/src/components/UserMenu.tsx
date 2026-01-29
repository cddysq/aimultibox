/**
 * 用户菜单组件
 * 
 * 未登录：显示用户图标，点击展开登录方式列表
 * 已登录：显示用户头像，点击展开用户菜单（退出等）
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { User, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// Google 图标 SVG
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

interface UserMenuProps {
  /** 移动端模式：列表形式而非下拉菜单 */
  mobile?: boolean
  /** 移动端点击后回调（用于关闭菜单） */
  onMobileClick?: () => void
}

export default function UserMenu({ mobile = false, onMobileClick }: UserMenuProps) {
  const { t } = useTranslation()
  const { user, googleClientId, promptLogin, logout, status } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭菜单
  useEffect(() => {
    if (mobile) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobile])

  // 没有配置任何登录方式时不显示
  if (!googleClientId) return null

  // 加载中状态
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 animate-pulse" />
    )
  }

  // 移动端模式
  if (mobile) {
    if (user) {
      return (
        <div className="space-y-1">
          <div className="flex items-center space-x-3 px-3 py-2 text-gray-600 dark:text-gray-300">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || user.email || 'user'}
                className="w-8 h-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            )}
            <span className="text-sm font-medium">{user.name || user.email || 'User'}</span>
          </div>
          <button
            onClick={() => {
              logout()
              onMobileClick?.()
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('common.layout.logout')}</span>
          </button>
        </div>
      )
    }

    // 未登录 - 移动端
    return (
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {t('common.layout.loginWith')}
        </div>
        {googleClientId && (
          <button
            onClick={() => {
              promptLogin()
              onMobileClick?.()
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-3"
          >
            <GoogleIcon className="w-5 h-5" />
            <span>Google</span>
          </button>
        )}
      </div>
    )
  }

  // 桌面端 - 已登录
  if (user) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center space-x-1.5 px-2 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name || user.email || 'user'}
              className="w-7 h-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50 overflow-hidden">
            {/* 用户信息 */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.name || 'User'}
              </div>
              {user.email && (
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {user.email}
                </div>
              )}
            </div>
            {/* 退出登录 */}
            <button
              onClick={() => {
                logout()
                setMenuOpen(false)
              }}
              className="w-full px-4 py-2.5 text-left flex items-center space-x-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-gray-300"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">{t('common.layout.logout')}</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  // 桌面端 - 未登录
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center space-x-1.5 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        title={t('common.layout.login')}
      >
        <User className="w-5 h-5" />
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50 overflow-hidden">
          {/* 标题 */}
          <div className="px-4 pb-2 mb-1 border-b border-gray-100 dark:border-slate-700">
            <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {t('common.layout.loginWith')}
            </div>
          </div>
          {/* Google 登录 */}
          {googleClientId && (
            <button
              onClick={() => {
                promptLogin()
                setMenuOpen(false)
              }}
              className="w-full px-4 py-2.5 text-left flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-gray-200"
            >
              <GoogleIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Google</span>
            </button>
          )}
          {/* 以后可以在这里添加更多登录方式 */}
          {/* 
          <button className="...">
            <AppleIcon />
            <span>Apple</span>
          </button>
          */}
        </div>
      )}
    </div>
  )
}
