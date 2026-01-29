/**
 * 应用入口
 * - 初始化主题
 * - 初始化 API
 * - 渲染应用或错误页面
 */
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import App from './App'
import { initApi } from './config'
import './config/i18n'
import './styles/index.css'
import { queryClient, queryPersister } from './config'
import { cacheUtils } from '@/utils/cache'

/** 初始化主题 */
const initTheme = () => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  try {
    const stored = cacheUtils.local.getJson<{ state?: { theme?: string } }>('aimultibox-theme')
    if (stored) {
      const { state } = stored
      const theme = state?.theme ?? 'system'
      if (theme === 'dark' || (theme === 'system' && prefersDark)) {
        document.documentElement.classList.add('dark')
      }
    } else if (prefersDark) {
      document.documentElement.classList.add('dark')
    }
  } catch {
    if (prefersDark) {
      document.documentElement.classList.add('dark')
    }
  }
}

initTheme()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')
const root = createRoot(rootElement)
let outageIntervalId: number | null = null
let outageKeydownHandler: ((e: KeyboardEvent) => void) | null = null

/**
 * 渲染服务不可用页面
 */
function renderError(_message: string) {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  // 获取当前语言
  const locale = cacheUtils.local.getOrSet('aimultibox-locale', () => 'zh')
  const isEn = locale === 'en'

  // 国际化文案
  const i18n = {
    title: isEn ? 'Service Unavailable' : '服务暂时不可用',
    description: isEn ? "We're under maintenance, please try again later" : '我们正在维护中，请稍后再试',
    retry: isEn ? 'Retry' : '重新尝试',
    waited: isEn ? 'Waited' : '已等待',
    easterEgg: isEn ? 'Easter egg unlocked! You found the secret!' : '彩蛋解锁！你找到了秘密！',
    duration: {
      days: isEn ? 'd' : ' 天 ',
      hours: isEn ? 'h' : ' 小时 ',
      minutes: isEn ? 'm' : ' 分钟 ',
      seconds: isEn ? 's' : ' 秒',
    },
    milestone: {
      '1min': isEn ? 'Take a break' : '休息一下',
      '5min': isEn ? 'Bored? Try ↑↑↓↓←→←→BA' : '无聊吧？试试 ↑↑↓↓←→←→BA',
      '10min': isEn ? 'Thanks for waiting' : '辛苦等待了',
      '30min': isEn ? 'Have some tea' : '泡杯茶吧',
      '1hour': isEn ? 'Maybe do something else?' : '要不先去忙其他的？',
      '6hour': isEn ? "You're so patient" : '真的很有耐心',
      '12hour': isEn ? 'Persistence is victory' : '坚持就是胜利',
      '24hour': isEn ? 'Legendary waiter!' : '传奇等待者！',
    },
  }

  // 主题色
  const colors = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    card: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? '#334155' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#1e293b',
    muted: isDark ? '#94a3b8' : '#64748b',
    primary: isDark ? '#38bdf8' : '#0891b2',
  }

  // 记录服务不可用开始时间
  const STORAGE_KEY = 'aimultibox_outage_start'
  const startTime = cacheUtils.local.getOrSet(STORAGE_KEY, () => Date.now().toString())

  /** 格式化等待时间为可读字符串 */
  function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const { duration: d } = i18n

    if (days > 0) return `${days}${d.days}${hours % 24}${d.hours}`
    if (hours > 0) return `${hours}${d.hours}${minutes % 60}${d.minutes}`
    if (minutes > 0) return `${minutes}${d.minutes}${seconds % 60}${d.seconds}`
    return `${seconds}${d.seconds}`
  }

  /** 根据等待时间返回里程碑文案 */
  function getMilestoneText(ms: number): string | null {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    const { milestone: m } = i18n

    if (hours >= 24) return `🌟 ${m['24hour']}`
    if (hours >= 12) return `🏆 ${m['12hour']}`
    if (hours >= 6) return `💪 ${m['6hour']}`
    if (hours >= 1) return `😴 ${m['1hour']}`
    if (minutes >= 30) return `🍵 ${m['30min']}`
    if (minutes >= 10) return `😴 ${m['10min']}`
    if (minutes >= 5) return `🎮 ${m['5min']}`
    if (minutes >= 1) return `☕ ${m['1min']}`
    return null
  }

  root.render(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: colors.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '1.5rem',
    }}>
      {/* 断开连接图标 */}
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.25rem',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18.36 6.64A9 9 0 0 1 20.77 15" />
          <path d="M6.16 6.16a9 9 0 1 0 12.68 12.68" />
          <path d="M12 2v4" />
          <path d="m2 2 20 20" />
        </svg>
      </div>

      {/* 标题 */}
      <h1 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: colors.text,
        margin: '0 0 0.375rem',
      }}>
        {i18n.title}
      </h1>

      {/* 描述 */}
      <p style={{
        fontSize: '0.875rem',
        color: colors.muted,
        margin: '0 0 1.5rem',
        textAlign: 'center',
      }}>
        {i18n.description}
      </p>

      {/* 按钮 */}
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.625rem 1.25rem',
          background: colors.primary,
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
          transition: 'all 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
      >
        {i18n.retry}
      </button>

      {/* 底部信息 */}
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        {/* 里程碑文案 */}
        <div
          id="milestone"
          style={{
            fontSize: '0.75rem',
            color: colors.muted,
            opacity: 0,
            transition: 'opacity 0.3s',
          }}
        />

        {/* 等待时间 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          color: colors.muted,
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#ef4444',
            animation: 'pulse 2s infinite',
          }} />
          {i18n.waited} <span id="duration" style={{ fontWeight: 500 }}>0{i18n.duration.seconds}</span>
        </div>

        {/* 反馈渠道 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <a
            href="mailto:tanghaotian.cn@gmail.com?subject=AIMultiBox 服务问题反馈"
            title="发送邮件"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              color: colors.muted,
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.color = colors.primary}
            onMouseOut={(e) => e.currentTarget.style.color = colors.muted}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </a>
          <a
            href="https://github.com/cddysq/aimultibox/issues"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Issues"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              color: colors.muted,
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.color = colors.primary}
            onMouseOut={(e) => e.currentTarget.style.color = colors.muted}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )

  // 启动定时器：更新等待时间和里程碑文案
  let lastMilestone = ''

  const updateDuration = () => {
    const durationEl = document.getElementById('duration')
    const milestoneEl = document.getElementById('milestone')

    if (durationEl && startTime) {
      const elapsed = Date.now() - parseInt(startTime)
      durationEl.textContent = formatDuration(elapsed)

      // 检查并更新里程碑文案
      if (milestoneEl) {
        const milestone = getMilestoneText(elapsed)
        if (milestone && milestone !== lastMilestone) {
          lastMilestone = milestone
          milestoneEl.textContent = milestone
          milestoneEl.style.opacity = '1'
        }
      }
    }
  }

  updateDuration()
  if (outageIntervalId !== null) {
    clearInterval(outageIntervalId)
  }
  outageIntervalId = window.setInterval(updateDuration, 1000)

  // Konami 秘籍彩蛋：↑↑↓↓←→←→BA
  const KONAMI_CODE = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA',
  ]
  let konamiIndex = 0

  if (outageKeydownHandler) {
    document.removeEventListener('keydown', outageKeydownHandler)
  }
  outageKeydownHandler = async (e: KeyboardEvent) => {
    if (e.code === KONAMI_CODE[konamiIndex]) {
      konamiIndex++

      // 输入完成，触发彩蛋
      if (konamiIndex === KONAMI_CODE.length) {
        konamiIndex = 0

        // 播放彩纸动画
        const confetti = (await import('canvas-confetti')).default
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0891b2', '#a855f7', '#f59e0b', '#10b981', '#ef4444'],
        })

        // 更新提示文案
        const milestoneEl = document.getElementById('milestone')
        if (milestoneEl) {
          milestoneEl.textContent = `🎉 ${i18n.easterEgg}`
          milestoneEl.style.opacity = '1'
        }
      }
    } else {
      konamiIndex = 0
    }
  }
  document.addEventListener('keydown', outageKeydownHandler)
}

/** 渲染主应用 */
function renderApp() {
  root.render(
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>,
  )
}

// 启动应用
initApi()
  .then(() => {
    cacheUtils.local.remove('aimultibox_outage_start')
    renderApp()
  })
  .catch((error) => {
    console.error('服务初始化失败:', error)
    renderError('无法连接到后端服务')
  })
