/**
 * 汇率数据管理 Hook（基于 TanStack Query）
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePrefsStore } from '@/stores'
import { useNotification, useSSE, type SSEEventData } from '@/hooks'
import { cacheUtils } from '@/utils/cache'
import {
  getToolInfo,
  getSummary,
  getRates,
  type RateData,
  type RateHistory,
  type RateStats,
  type ProfitSummary,
  type TradeRecord,
  type SchedulerStatus,
} from '../api'
import {
  DEFAULT_CURRENCY_PAIR,
  STORAGE_KEYS,
  type TimeRange,
} from '../utils/constants'
import { getErrorMessage, getErrorStatus } from '@/types'

/** 查询 key 规范（工具维度统一命名） */
const QUERY_KEYS = {
  toolInfo: ['currency', 'toolInfo'] as const,
  summary: (pair: string, days: number) => ['currency', 'summary', pair, days] as const,
  rates: ['currency', 'rates'] as const,
}

export function useCurrencyData() {
  const { t } = useTranslation()
  const { theme } = usePrefsStore()
  const queryClient = useQueryClient()

  const [currencyPair, setCurrencyPair] = useState(DEFAULT_CURRENCY_PAIR)
  const [timeRange, setTimeRangeState] = useState<TimeRange>(() => {
    const saved = cacheUtils.local.getNumber(STORAGE_KEYS.TIME_RANGE)
    if (saved && [7, 30, 90].includes(saved)) {
      return saved as TimeRange
    }
    return 7
  })
  const [notificationEnabled, setNotificationEnabled] = useState<boolean>(() => {
    const saved = cacheUtils.local.getBool(STORAGE_KEYS.NOTIFICATION_ENABLED)
    if (saved === null) return true
    return saved
  })
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const tRef = useRef(t)
  const notificationEnabledRef = useRef(notificationEnabled)
  const isGrantedRef = useRef(false)

  const { isGranted, requestPermission, notify } = useNotification()

  const toolInfoQuery = useQuery({
    queryKey: QUERY_KEYS.toolInfo,
    queryFn: getToolInfo,
    staleTime: 10 * 60_000,
  })

  const summaryQuery = useQuery({
    queryKey: QUERY_KEYS.summary(currencyPair, timeRange),
    queryFn: () => getSummary(currencyPair, timeRange),
    staleTime: 60_000,
  })

  const ratesQuery = useQuery({
    queryKey: QUERY_KEYS.rates,
    queryFn: () => getRates(false),
    staleTime: 30_000,
  })

  const rates = (summaryQuery.data?.rates || []) as RateData[]
  const history = (summaryQuery.data?.history || []) as RateHistory[]
  const stats = (summaryQuery.data?.stats || null) as RateStats | null
  const profitSummary = (summaryQuery.data?.profit || null) as ProfitSummary | null
  const trades = (summaryQuery.data?.trades || []) as TradeRecord[]
  const schedulerStatus = (summaryQuery.data?.scheduler || null) as SchedulerStatus | null

  const currentRate = rates.find((r) => r.currency_pair === currencyPair)
  const dataSourceUpdateTime = currentRate?.time_str

  const nextRefreshTime = schedulerStatus?.next_refresh_time
    ? new Date(schedulerStatus.next_refresh_time)
    : null

  const isDarkMode =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  /** 发送预警浏览器通知 */
  const sendAlertNotification = useCallback(
    (alert: SSEEventData['alert_triggered']) => {
      if (!isGrantedRef.current || !notificationEnabledRef.current) return

      const conditionText =
        alert.condition === 'rate_above'
          ? tRef.current('currency.alerts.conditions.rate_above')
          : alert.condition === 'rate_below'
            ? tRef.current('currency.alerts.conditions.rate_below')
            : tRef.current('currency.alerts.conditions.daily_change_above')

      notify({
        title: tRef.current('currency.notification.alertTitle'),
        body: `${alert.currency_pair}: ${conditionText} ${alert.threshold}\n${tRef.current('currency.notification.currentRate')}: ${alert.current_rate.toFixed(4)}`,
        tag: `alert-${alert.alert_id}-${Date.now()}`,
      })
    },
    [notify]
  )


  const setTimeRange = useCallback((days: TimeRange) => {
    setTimeRangeState(days)
    cacheUtils.local.setNumber(STORAGE_KEYS.TIME_RANGE, days)
  }, [])

  const handleCurrencyPairChange = useCallback((pair: string) => {
    setCurrencyPair(pair)
  }, [])

  const toggleNotificationEnabled = useCallback(() => {
    setNotificationEnabled((prev) => {
      const next = !prev
      cacheUtils.local.setBool(STORAGE_KEYS.NOTIFICATION_ENABLED, next)
      notificationEnabledRef.current = next
      return next
    })
  }, [])

  // SSE 连接
  const { isConnected, on, off, reconnect } = useSSE({})

  /** 手动刷新（强制从数据源获取） */
  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      const data = await getRates(true)
      queryClient.setQueryData(QUERY_KEYS.rates, data)
      await queryClient.invalidateQueries({ queryKey: ['currency', 'summary'] })

      if (!isConnected) {
        reconnect()
      }
    } catch (err) {
      setError(getErrorMessage(err, tRef.current('errors.backendUnavailable')))
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, reconnect, isConnected])

  // SSE 事件处理
  useEffect(() => {
    const handleRatesUpdated = async () => {
      try {
        const data = await getRates(false)
        queryClient.setQueryData(QUERY_KEYS.rates, data)
        await queryClient.invalidateQueries({ queryKey: ['currency', 'summary'] })
      } catch (err) {
        console.warn('rates_updated 处理失败，等待下次刷新:', err)
      }
    }

    const handleAlertTriggered = (alert: SSEEventData['alert_triggered']) => {
      sendAlertNotification(alert)
    }

    on('rates_updated', handleRatesUpdated)
    on('alert_triggered', handleAlertTriggered)

    return () => {
      off('rates_updated', handleRatesUpdated)
      off('alert_triggered', handleAlertTriggered)
    }
  }, [on, off, queryClient, sendAlertNotification])

  // 统一错误输出
  useEffect(() => {
    const err = summaryQuery.error || ratesQuery.error || toolInfoQuery.error
    if (!err) {
      setError('')
      return
    }
    const status = getErrorStatus(err)
    if (status === 429) {
      setError(tRef.current('errors.rateLimited'))
    } else {
      setError(getErrorMessage(err, tRef.current('errors.backendUnavailable')))
    }
  }, [summaryQuery.error, ratesQuery.error, toolInfoQuery.error])

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    isGrantedRef.current = isGranted
  }, [isGranted])

  useEffect(() => {
    notificationEnabledRef.current = notificationEnabled
  }, [notificationEnabled])

  return {
    toolInfo: toolInfoQuery.data || null,
    currencyPair,
    setCurrencyPair: handleCurrencyPairChange,
    timeRange,
    setTimeRange,
    rates,
    history,
    stats,
    profitSummary,
    trades,
    currentRate,
    dataSourceUpdateTime,
    isDarkMode,
    loading: summaryQuery.isLoading || toolInfoQuery.isLoading,
    refreshing,
    error,
    schedulerStatus,
    sseConnected: isConnected,
    autoRefresh: {
      enabled: true,
      nextRefreshTime,
      toggle: () => {},
    },
    notification: {
      isGranted,
      requestPermission,
      enabled: notificationEnabled,
      toggleEnabled: toggleNotificationEnabled,
    },
    refresh,
    loadSummary: () => queryClient.invalidateQueries({ queryKey: ['currency', 'summary'] }),
  }
}
