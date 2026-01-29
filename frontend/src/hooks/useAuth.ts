import { useCallback, useEffect, useRef } from 'react'
import { getBackendConfig } from '@/config/api'
import { getAuthMe, loginWithGoogle, logout as apiLogout } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { cacheUtils } from '@/utils/cache'

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string
            callback: (response: { credential?: string }) => void
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (container: HTMLElement, options: Record<string, unknown>) => void
          prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void
          disableAutoSelect: () => void
        }
        oauth2?: {
          initCodeClient: (config: {
            client_id: string
            scope: string
            callback: (response: { code?: string; error?: string }) => void
          }) => { requestCode: () => void }
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

export function useAuth() {
  const {
    status,
    user,
    googleClientId,
    setStatus,
    setUser,
    setGoogleClientId,
  } = useAuthStore()

  const initializedRef = useRef(false)

  const handleCredential = useCallback(async (credential?: string) => {
    if (!credential) return
    try {
      const result = await loginWithGoogle(credential)
      setUser(result.user ?? null)
    } catch (error) {
      console.error('Google 登录失败:', error)
      setStatus('anonymous')
    }
  }, [setUser, setStatus])

  const ensureGoogleInitialized = useCallback(() => {
    if (!googleClientId) return false
    const google = window.google?.accounts?.id
    if (!google) return false
    if (initializedRef.current) return true
    google.initialize({
      client_id: googleClientId,
      callback: (response) => handleCredential(response?.credential),
      cancel_on_tap_outside: false,
    })
    initializedRef.current = true
    return true
  }, [googleClientId, handleCredential])

  // 预渲染的隐藏按钮容器（用于 OAuth 弹窗快速触发）
  const hiddenBtnRef = useRef<{ container: HTMLDivElement; button: HTMLElement | null } | null>(null)

  // One Tap 历史状态（记住上次是否失败）
  const ONE_TAP_FAILED_KEY = 'aimultibox_one_tap_failed'
  const isOneTapHistoricallyFailed = () => {
    return cacheUtils.local.getBool(ONE_TAP_FAILED_KEY) === true
  }
  const markOneTapFailed = () => {
    cacheUtils.local.setBool(ONE_TAP_FAILED_KEY, true)
  }
  const clearOneTapFailedFlag = () => {
    cacheUtils.local.remove(ONE_TAP_FAILED_KEY)
  }

  // Google Identity API 类型
  type GoogleIdApi = NonNullable<NonNullable<typeof window.google>['accounts']>['id']

  // 预渲染隐藏的 Google 按钮（并行准备）
  const prepareHiddenButton = useCallback((google: GoogleIdApi) => {
    if (hiddenBtnRef.current || !google) return // 已准备好或无效

    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;'
    document.body.appendChild(container)

    try {
      google.renderButton(container, {
        type: 'standard',
        size: 'large',
        theme: 'outline',
        text: 'signin_with',
      })
      // 等待渲染完成
      requestAnimationFrame(() => {
        const button = container.querySelector('div[role="button"]') as HTMLElement
        hiddenBtnRef.current = { container, button }
      })
    } catch {
      container.remove()
    }
  }, [])

  // 点击隐藏按钮打开 OAuth 弹窗
  const clickHiddenButton = useCallback(() => {
    const btn = hiddenBtnRef.current?.button
    if (btn) {
      btn.click()
    }
  }, [])

  const promptLogin = useCallback(() => {
    let retryCount = 0
    const maxRetries = 10

    const tryPrompt = () => {
      const google = window.google?.accounts?.id
      if (!google) {
        if (retryCount++ < maxRetries) {
          setTimeout(tryPrompt, 200)
        } else {
          console.error('Google SDK 加载超时')
        }
        return
      }

      if (!ensureGoogleInitialized()) return

      // 提前准备 OAuth 按钮
      prepareHiddenButton(google)

      // 智能策略：如果上次 One Tap 失败过，直接用 OAuth
      if (isOneTapHistoricallyFailed()) {
        setTimeout(clickHiddenButton, 100)
        return
      }

      // 尝试 One Tap，但设置超时保护
      let oneTapHandled = false
      const timeout = setTimeout(() => {
        if (!oneTapHandled) {
          oneTapHandled = true
          markOneTapFailed()
          clickHiddenButton()
        }
      }, 800) // 800ms 超时

      google.prompt((notification) => {
        if (oneTapHandled) return
        oneTapHandled = true
        clearTimeout(timeout)

        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          markOneTapFailed()
          clickHiddenButton()
        } else {
          // One Tap 成功，清除失败标记
          clearOneTapFailedFlag()
        }
      })
    }

    tryPrompt()
  }, [ensureGoogleInitialized, prepareHiddenButton, clickHiddenButton])

  // 组件卸载时清理隐藏按钮
  useEffect(() => {
    return () => {
      hiddenBtnRef.current?.container.remove()
      hiddenBtnRef.current = null
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setUser(null)
      setStatus('anonymous')
      window.google?.accounts?.id?.disableAutoSelect()
    }
  }, [setStatus, setUser])

  useEffect(() => {
    const config = getBackendConfig()
    if (config?.googleClientId) {
      setGoogleClientId(config.googleClientId)
    }
  }, [setGoogleClientId])

  useEffect(() => {
    if (status !== 'idle') return
    setStatus('loading')
    getAuthMe()
      .then((result) => {
        const currentUser = result.user ?? null
        setUser(currentUser)
        if (!currentUser) {
          setStatus('anonymous')
        }
      })
      .catch((error) => {
        console.error('获取登录状态失败:', error)
        setStatus('anonymous')
      })
  }, [setStatus, setUser, status])

  return {
    status,
    user,
    googleClientId,
    promptLogin,
    logout,
    isAuthenticated: status === 'authenticated',
  }
}
