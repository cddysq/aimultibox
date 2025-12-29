/**
 * 汇率数据管理 Hook
 *
 * 统一管理汇率工具的所有数据获取和状态
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores'
import { useNotification } from '@/hooks'
import {
  getToolInfo,
  getRates,
  refreshRates,
  getRateHistory,
  getRateStats,
  getProfit,
  type ToolInfo,
  type RateData,
  type RateHistory,
  type RateStats,
  type ProfitSummary,
  type TradeRecord,
  type TriggeredAlert,
} from '../api'
import {
  DEFAULT_CURRENCY_PAIR,
  DEFAULT_REFRESH_INTERVAL,
  STORAGE_KEYS,
  type TimeRange,
} from '../utils/constants'
import { getErrorMessage, getErrorStatus } from '@/types'

// =============================================================================
// Hook
// =============================================================================

export function useCurrencyData() {
  const { t } = useTranslation()
  const { theme } = useThemeStore()

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [toolInfo, setToolInfo] = useState<ToolInfo | null>(null)
  const [currencyPair, setCurrencyPair] = useState(DEFAULT_CURRENCY_PAIR)
  const [timeRange, setTimeRange] = useState<TimeRange>(7)

  const [rates, setRates] = useState<RateData[]>([])
  const [history, setHistory] = useState<RateHistory[]>([])
  const [stats, setStats] = useState<RateStats | null>(null)
  const [profitSummary, setProfitSummary] = useState<ProfitSummary | null>(null)
  const [trades, setTrades] = useState<TradeRecord[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // 自动刷新状态
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [refreshInterval, setRefreshIntervalState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REFRESH_INTERVAL)
    return saved ? parseInt(saved, 10) : DEFAULT_REFRESH_INTERVAL
  })
  const [countdown, setCountdown] = useState(refreshInterval)

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  const loadDataRef = useRef<((silent?: boolean, force?: boolean) => Promise<void>) | undefined>(undefined)

  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------

  const { isGranted, requestPermission, notify } = useNotification()

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const currentRate = rates.find((r) => r.currency_pair === currencyPair)
  const currentRateTime = currentRate?.time_str
  const isDarkMode =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  const sendAlertNotifications = useCallback(
    (alerts: TriggeredAlert[]) => {
      if (!isGranted || alerts.length === 0) return
      const timestamp = Date.now()
      alerts.forEach((alert) => {
        const conditionText =
          alert.condition === 'rate_above'
            ? t('currency.alerts.conditions.rate_above')
            : alert.condition === 'rate_below'
              ? t('currency.alerts.conditions.rate_below')
              : t('currency.alerts.conditions.daily_change_above')
        notify({
          title: t('currency.notification.alertTitle'),
          body: `${alert.currency_pair}: ${conditionText} ${alert.threshold}\n${t('currency.notification.currentRate')}: ${alert.current_rate.toFixed(4)}`,
          // 每次触发都是新通知，不覆盖旧的
          tag: `alert-${alert.alert_id}-${timestamp}`,
        })
      })
    },
    [isGranted, notify, t]
  )

  const loadData = useCallback(
    async (silent = false, forceRefresh = false) => {
      if (!silent) setLoading(true)
      setError('')
      try {
        // forceRefresh 时调用 refreshRates（会检查预警），否则调用 getRates
        const ratesRes = forceRefresh ? await refreshRates() : await getRates()
        setRates(ratesRes.data || [])
        if (ratesRes.triggered_alerts?.length) {
          sendAlertNotifications(ratesRes.triggered_alerts)
        }
        const [historyRes, statsRes, profitRes] = await Promise.all([
          getRateHistory(currencyPair, timeRange),
          getRateStats(currencyPair, timeRange).catch(() => ({ data: null })),
          getProfit(currencyPair),
        ])
        setHistory(historyRes.data || [])
        setStats(statsRes.data)
        setProfitSummary(profitRes.summary)
        setTrades(profitRes.trades || [])
        setCountdown(refreshInterval)
      } catch (err) {
        // 自动刷新时的限流错误静默处理
        if (silent && getErrorStatus(err) === 429) {
          console.log('Auto refresh rate limited, will retry next cycle')
          return
        }
        console.error('Load data failed:', err)
        setError(getErrorMessage(err, t('errors.loadToolsFailed')))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [currencyPair, timeRange, t, sendAlertNotifications, refreshInterval]
  )

  // 保存 loadData 引用
  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadData(false, true) // 显示 loading，强制刷新
    } finally {
      setRefreshing(false)
    }
  }, [loadData])

  const setRefreshInterval = useCallback((seconds: number) => {
    const config = toolInfo?.refresh_config
    const min = config?.min_interval ?? 60
    const max = config?.max_interval ?? 1800
    const valid = Math.max(min, Math.min(max, seconds))
    setRefreshIntervalState(valid)
    setCountdown(valid)
    localStorage.setItem(STORAGE_KEYS.REFRESH_INTERVAL, String(valid))
  }, [toolInfo])

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled((prev) => !prev)
  }, [])

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // 加载工具配置
  useEffect(() => {
    getToolInfo()
      .then((info) => {
        setToolInfo(info)
        if (info.refresh_config) {
          const saved = localStorage.getItem(STORAGE_KEYS.REFRESH_INTERVAL)
          const interval = saved
            ? Math.max(
                info.refresh_config.min_interval,
                Math.min(info.refresh_config.max_interval, parseInt(saved))
              )
            : info.refresh_config.default_interval
          setRefreshIntervalState(interval)
          setCountdown(interval)
        }
      })
      .catch(console.error)
  }, [])

  // 数据变化时重新加载
  useEffect(() => {
    loadData()
  }, [loadData])

  // 自动刷新倒计时
  useEffect(() => {
    if (!autoRefreshEnabled) return
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? refreshInterval : prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [autoRefreshEnabled, refreshInterval])

  // 倒计时到 1 时触发刷新
  useEffect(() => {
    if (autoRefreshEnabled && countdown === 1) {
      loadDataRef.current?.(true, true)
    }
  }, [countdown, autoRefreshEnabled])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    toolInfo,
    currencyPair,
    setCurrencyPair,
    timeRange,
    setTimeRange,
    rates,
    history,
    stats,
    profitSummary,
    trades,
    currentRate,
    currentRateTime,
    isDarkMode,
    loading,
    refreshing,
    error,
    autoRefresh: {
      enabled: autoRefreshEnabled,
      countdown,
      interval: refreshInterval,
      toggle: toggleAutoRefresh,
      setInterval: setRefreshInterval,
    },
    notification: {
      isGranted,
      requestPermission,
    },
    refresh,
    loadData,
  }
}
