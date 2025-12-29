/**
 * 汇率管家主页面
 */
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  TrendingUp,
  RefreshCw,
  Plus,
  Loader2,
  AlertCircle,
  Clock,
  Settings,
  Bell,
} from 'lucide-react'
import { useCurrencyData } from './hooks/useCurrencyData'
import { TIME_RANGES, REFRESH_INTERVALS, type TimeRange } from './utils/constants'
import { formatCountdown } from './utils/format'
import RateChart from './components/RateChart'
import RateStats from './components/RateStats'
import ProfitSummary from './components/ProfitSummary'
import TradeList from './components/TradeList'
import TradeModal from './components/TradeModal'
import AlertConfig from './components/AlertConfig'
import Calculator from './components/Calculator'
import CurrencySelect, { type CurrencyOption } from './components/CurrencySelect'

export default function CurrencyManagerPage() {
  const { t, i18n } = useTranslation()

  const {
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
    autoRefresh,
    notification,
    refresh,
    loadData,
  } = useCurrencyData()

  const [showSettings, setShowSettings] = useState(false)
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [prefillRate, setPrefillRate] = useState<number | undefined>()
  const [prefillTimestamp, setPrefillTimestamp] = useState<string | undefined>()

  const settingsRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭设置弹窗
  useEffect(() => {
    if (!showSettings) return

    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings])

  const handleChartClick = (rate: number, timestamp: string) => {
    setPrefillRate(rate)
    setPrefillTimestamp(timestamp)
    setTradeModalOpen(true)
  }

  const handleAddTrade = () => {
    setPrefillRate(currentRate?.rate)
    setPrefillTimestamp(undefined)
    setTradeModalOpen(true)
  }

  // 货币选项（中文直接用后端返回值，英文查 i18n 翻译）
  const isZh = i18n.language === 'zh'
  const currencyOptions: CurrencyOption[] = (toolInfo?.supported_currencies || []).map(c => ({
    code: c.pair?.split('_')[0] || 'UNKNOWN',
    name: isZh ? c.name : t(`currencies.${c.pair}`, { defaultValue: c.name }),
    pair: c.pair,
  }))

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <Link
            to="/"
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600 dark:text-primary-400 flex-shrink-0" />
              <span className="truncate">{t('currency.title')}</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 truncate">
              {t('currency.subtitle')}
            </p>
          </div>
        </div>

        {/* 右侧按钮组 */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          {/* 更新时间 + 倒计时 */}
          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            {currentRateTime && (
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{currentRateTime}</span>
              </span>
            )}
            {autoRefresh.enabled && (
              <span className="text-primary-600 dark:text-primary-400 font-mono">
                ({formatCountdown(autoRefresh.countdown)})
              </span>
            )}
          </div>

          {/* 设置按钮 */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title={t('currency.settings')}
            >
              <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>

            {/* 设置弹出菜单 */}
            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 p-4 z-50">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  {t('currency.refreshSettings')}
                </h4>

                {/* 自动刷新开关 */}
                <label className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('currency.autoRefresh')}
                  </span>
                  <button
                    onClick={autoRefresh.toggle}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      autoRefresh.enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
                        autoRefresh.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </label>

                {/* 刷新间隔选择 */}
                <div className="space-y-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('currency.refreshInterval')}
                  </span>
                  <select
                    value={autoRefresh.interval}
                    onChange={(e) => autoRefresh.setInterval(parseInt(e.target.value))}
                    disabled={!autoRefresh.enabled}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    {REFRESH_INTERVALS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(`currency.intervals.${opt.labelKey}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 通知权限 */}
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('currency.notification.enable')}
                    </span>
                    {notification.isGranted ? (
                      <span className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400">
                        <Bell className="w-3.5 h-3.5" />
                        <span>{t('currency.notification.enabled')}</span>
                      </span>
                    ) : (
                      <button
                        onClick={notification.requestPermission}
                        className="text-xs px-2 py-1 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                      >
                        {t('currency.notification.request')}
                      </button>
                    )}
                  </div>
                </div>

                {/* 移动端显示更新时间 */}
                <div className="sm:hidden mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                  {currentRateTime && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('currency.lastUpdate')}: {currentRateTime}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t('currency.refresh')}</span>
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 货币对选择 + 时间范围 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('currency.selectCurrency')}:
          </span>
          <CurrencySelect
            value={currencyPair}
            options={currencyOptions}
            onChange={setCurrencyPair}
            displayMode="pair"
            size="sm"
          />
        </div>

        <div className="flex items-center space-x-2">
          {TIME_RANGES.map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days as TimeRange)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                timeRange === days
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {days}
              {t('currency.days')}
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：图表 + 交易列表 */}
        <div className="lg:col-span-2 space-y-4">
          <RateChart
            history={history}
            trades={trades}
            loading={loading}
            onPointClick={handleChartClick}
            darkMode={isDarkMode}
          />
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('currency.tradeHistory')}
              </h2>
              <button
                onClick={handleAddTrade}
                className="flex items-center space-x-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{t('currency.addTrade')}</span>
              </button>
            </div>
            <TradeList
              trades={trades}
              loading={loading}
              onRefresh={loadData}
              currencyPair={currencyPair}
            />
          </div>
        </div>

        {/* 右侧：统计 + 计算器 + 盈亏 + 预警 */}
        <div className="space-y-4">
          <RateStats stats={stats} currentRateData={currentRate} loading={loading} />
          <Calculator rates={rates} currencies={toolInfo?.supported_currencies || []} />
          <ProfitSummary summary={profitSummary} loading={loading} />
          <AlertConfig currencyPair={currencyPair} currentRate={currentRate?.rate} />
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">
          {t('currency.guide.title')}
        </h3>
        <ol className="text-blue-800 dark:text-blue-400 space-y-2 text-sm list-decimal list-inside">
          <li>{t('currency.guide.step1')}</li>
          <li>{t('currency.guide.step2')}</li>
          <li>{t('currency.guide.step3')}</li>
          <li>{t('currency.guide.step4')}</li>
        </ol>
      </div>

      {/* 交易弹窗 */}
      <TradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        onSuccess={() => loadData()}
        currencyPair={currencyPair}
        prefillRate={prefillRate}
        prefillTimestamp={prefillTimestamp}
      />
    </div>
  )
}
