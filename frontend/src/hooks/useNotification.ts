/**
 * 浏览器通知 Hook - 公共能力
 *
 * 提供统一的浏览器通知管理能力，可被所有工具复用
 *
 * @features
 * - 权限状态管理
 * - 请求权限
 * - 发送通知
 * - 权限变化监听
 */
import { useState, useEffect, useCallback } from 'react'

interface NotificationOptions {
  /** 通知标题 */
  title: string
  /** 通知内容 */
  body: string
  /** 图标 */
  icon?: string
  /** 标签 (相同标签会替换旧通知) */
  tag?: string
  /** 点击回调 */
  onClick?: () => void
}

interface UseNotificationReturn {
  /** 是否已授权 */
  isGranted: boolean
  /** 是否支持通知 */
  isSupported: boolean
  /** 权限状态: granted | denied | default | unsupported */
  permission: NotificationPermission | 'unsupported'
  /** 请求权限，返回是否成功 */
  requestPermission: () => Promise<boolean>
  /** 发送通知 */
  notify: (options: NotificationOptions) => Notification | null
}

/**
 * 浏览器通知 Hook
 *
 * @example
 * const { isGranted, requestPermission, notify } = useNotification()
 *
 * // 请求权限
 * await requestPermission()
 *
 * // 发送通知
 * notify({
 *   title: '汇率预警',
 *   body: 'JPY/CNY 汇率已达到 0.0450',
 *   tag: 'rate-alert-123'
 * })
 */
export function useNotification(): UseNotificationReturn {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!isSupported) return 'unsupported'
    return Notification.permission
  })

  // 监听权限变化
  useEffect(() => {
    if (!isSupported) return

    // 部分浏览器支持 permissions API
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          const handleChange = () => setPermission(Notification.permission)
          status.addEventListener('change', handleChange)
          return () => status.removeEventListener('change', handleChange)
        })
        .catch(() => {
          // 忽略不支持的浏览器
        })
    }
  }, [isSupported])

  // 请求权限
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch {
      return false
    }
  }, [isSupported])

  // 发送通知
  const notify = useCallback(
    (options: NotificationOptions): Notification | null => {
      if (!isSupported || permission !== 'granted') return null

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/favicon.ico',
          tag: options.tag,
        })

        if (options.onClick) {
          notification.onclick = () => {
            window.focus()
            options.onClick?.()
            notification.close()
          }
        }

        return notification
      } catch {
        return null
      }
    },
    [isSupported, permission]
  )

  return {
    isGranted: permission === 'granted',
    isSupported,
    permission,
    requestPermission,
    notify,
  }
}
