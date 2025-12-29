/**
 * 确认弹窗组件
 *
 * 替代原生 window.confirm()，提供统一的确认交互体验
 *
 * @features
 * - 四种语义类型: info / warning / danger / success
 * - 深色/浅色主题适配
 * - 移动端响应式设计
 * - 键盘操作: Enter 确认 / Esc 取消
 * - 加载状态支持
 * - ARIA 无障碍访问
 * - 焦点陷阱 + 背景滚动锁定
 * - Portal 渲染避免层级问题
 */
import { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export type ConfirmModalType = 'info' | 'warning' | 'danger' | 'success'

interface ConfirmModalProps {
  /** 是否显示 */
  isOpen: boolean
  /** 语义类型，影响图标和按钮颜色 */
  type?: ConfirmModalType
  /** 标题 */
  title?: string
  /** 消息内容 */
  message: string
  /** 确认按钮文字 */
  confirmText?: string
  /** 取消按钮文字 */
  cancelText?: string
  /** 加载状态 */
  loading?: boolean
  /** 确认回调 */
  onConfirm: () => void
  /** 取消回调 */
  onCancel: () => void
}

// ============================================================================
// Constants
// ============================================================================

/** 类型样式配置 */
const TYPE_CONFIG = {
  info: {
    icon: Info,
    iconBg: 'bg-blue-50 dark:bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600',
  },
  warning: {
    icon: AlertCircle,
    iconBg: 'bg-amber-50 dark:bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 dark:bg-amber-500 dark:hover:bg-amber-600',
  },
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-red-50 dark:bg-red-500/10',
    iconColor: 'text-red-600 dark:text-red-400',
    buttonClass: 'bg-red-600 hover:bg-red-700 active:bg-red-800 dark:bg-red-500 dark:hover:bg-red-600',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-600',
  },
} as const

// ============================================================================
// Component
// ============================================================================

export default function ConfirmModal({
  isOpen,
  type = 'info',
  title,
  message,
  confirmText,
  cancelText,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation()
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const config = TYPE_CONFIG[type]
  const IconComponent = config.icon

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    onCancel()
  }, [onCancel])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || loading) return
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      } else if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault()
        onConfirm()
      }
    },
    [isOpen, loading, handleClose, onConfirm]
  )

  /** 焦点陷阱 - Tab 循环在弹窗内 */
  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault()
      lastElement?.focus()
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault()
      firstElement?.focus()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) return

    // 保存当前焦点
    previousActiveElement.current = document.activeElement as HTMLElement

    // 锁定背景滚动
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'

    // 绑定键盘事件
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keydown', handleTabKey)

    // 自动聚焦确认按钮
    requestAnimationFrame(() => {
      modalRef.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus()
    })

    return () => {
      // 恢复滚动位置
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)

      // 移除键盘事件
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keydown', handleTabKey)

      // 恢复之前的焦点
      previousActiveElement.current?.focus()
    }
  }, [isOpen, handleKeyDown, handleTabKey])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby="modal-description"
    >
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={loading ? undefined : handleClose}
        aria-hidden="true"
      />

      {/* 弹窗主体 */}
      <div
        ref={modalRef}
        className="relative w-full max-w-[340px] sm:max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl 
                   ring-1 ring-black/5 dark:ring-white/10
                   transform transition-all duration-200 ease-out
                   animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4"
      >
        {/* 内容区 */}
        <div className="p-5 sm:p-6">
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            disabled={loading}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full
                       text-gray-400 dark:text-gray-500
                       hover:text-gray-600 dark:hover:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-slate-700
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                       transition-colors disabled:opacity-40 disabled:pointer-events-none"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
          </button>

          {/* 图标 */}
          <div className={`w-11 h-11 sm:w-12 sm:h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${config.iconBg}`}>
            <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 ${config.iconColor}`} strokeWidth={2} />
          </div>

          {/* 标题 */}
          {title && (
            <h2
              id="modal-title"
              className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white text-center mb-2"
            >
              {title}
            </h2>
          )}

          {/* 消息 */}
          <p
            id="modal-description"
            className="text-sm sm:text-base text-gray-600 dark:text-gray-300 text-center leading-relaxed"
          >
            {message}
          </p>
        </div>

        {/* 按钮区 - 移动端可点击区域更大 */}
        <div className="flex gap-3 p-4 sm:p-5 pt-0 sm:pt-0">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 h-11 sm:h-10 px-4 rounded-xl sm:rounded-lg
                       bg-gray-100 dark:bg-slate-700
                       text-gray-700 dark:text-gray-200
                       hover:bg-gray-200 dark:hover:bg-slate-600
                       active:bg-gray-300 dark:active:bg-slate-500
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
                       font-medium text-sm transition-colors
                       disabled:opacity-40 disabled:pointer-events-none"
          >
            {cancelText || t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            data-autofocus
            className={`flex-1 h-11 sm:h-10 px-4 rounded-xl sm:rounded-lg
                        text-white font-medium text-sm
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800
                        transition-colors
                        disabled:opacity-40 disabled:pointer-events-none
                        flex items-center justify-center gap-2
                        ${config.buttonClass}
                        ${type === 'info' ? 'focus-visible:ring-blue-500' : ''}
                        ${type === 'warning' ? 'focus-visible:ring-amber-500' : ''}
                        ${type === 'danger' ? 'focus-visible:ring-red-500' : ''}
                        ${type === 'success' ? 'focus-visible:ring-emerald-500' : ''}`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              confirmText || t('common.confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  )

  // 使用 Portal 渲染到 body，避免 z-index 层级问题
  return createPortal(modalContent, document.body)
}
