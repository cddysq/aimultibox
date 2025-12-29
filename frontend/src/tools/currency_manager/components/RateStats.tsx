/** 汇率统计卡片 */
import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown, Clock, Flame, ArrowDownCircle } from 'lucide-react'
import type { RateStats as RateStatsType, RateData } from '../api'
import { formatRate, formatChange, formatDate } from '../utils/format'

interface Props {
  stats: RateStatsType | null
  currentRateData?: RateData | null
  loading?: boolean
}

export default function RateStats({ stats, currentRateData, loading }: Props) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-24 mb-4" />
        <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded w-32 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-slate-700 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 text-center text-gray-500 dark:text-gray-400">
        {t('currency.noData')}
      </div>
    )
  }

  const isUp = stats.change >= 0
  const changeColor = isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  const ChangeIcon = isUp ? TrendingUp : TrendingDown

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
      {/* 头部：货币对 + 时间 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-base font-semibold text-gray-900 dark:text-white">
          {stats.currency_pair.replace('_', '/')}
        </span>
        <div className="flex items-center text-xs text-gray-400 dark:text-gray-500">
          <Clock className="w-3.5 h-3.5 mr-1" />
          {currentRateData?.time_str || formatDate(stats.updated_at)}
        </div>
      </div>

      {/* 趋势标签（独立行） */}
      {stats.streak_days !== 0 && Math.abs(stats.streak_days) >= 2 && (
        <div className="mb-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            stats.streak_days > 0 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {stats.streak_days > 0 ? <Flame className="w-3.5 h-3.5" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}
            <span>
              {stats.streak_days > 0 
                ? t('currency.streak.rising', { days: stats.streak_days })
                : t('currency.streak.falling', { days: Math.abs(stats.streak_days) })}
              {' '}{stats.streak_change >= 0 ? '+' : ''}{stats.streak_change.toFixed(2)}%
            </span>
          </span>
        </div>
      )}

      {/* 中间价 + 涨跌幅 */}
      <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatRate(stats.current)}
          </span>
          <span className="text-sm text-gray-400 dark:text-gray-500">{t('currency.midRate')}</span>
        </div>
        <div className={`flex items-center text-xl font-semibold ${changeColor}`}>
          <ChangeIcon className="w-5 h-5 mr-1" />
          <span>{formatChange(stats.change)}</span>
        </div>
      </div>

      {/* 四种汇率 */}
      {currentRateData && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="text-xs text-green-600 dark:text-green-400 mb-3 font-medium">
              {t('currency.sellForeignTitle')}
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-600/80 dark:text-green-400/80">现汇</span>
                <span className="text-sm font-bold text-green-700 dark:text-green-300">
                  {formatRate(currentRateData.rtb_bid)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-600/80 dark:text-green-400/80">现钞</span>
                <span className="text-sm font-bold text-green-700 dark:text-green-300">
                  {formatRate(currentRateData.rth_bid)}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div className="text-xs text-red-600 dark:text-red-400 mb-3 font-medium">
              {t('currency.buyForeignTitle')}
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-red-600/80 dark:text-red-400/80">现汇</span>
                <span className="text-sm font-bold text-red-700 dark:text-red-300">
                  {formatRate(currentRateData.rtc_ofr)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-red-600/80 dark:text-red-400/80">现钞</span>
                <span className="text-sm font-bold text-red-700 dark:text-red-300">
                  {formatRate(currentRateData.rth_ofr)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 高/低/均值 */}
      <div className="flex justify-between text-center pt-3 border-t border-gray-100 dark:border-slate-700">
        <div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('currency.high')}</div>
          <div className="text-base font-semibold text-gray-900 dark:text-white">{formatRate(stats.high)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('currency.low')}</div>
          <div className="text-base font-semibold text-gray-900 dark:text-white">{formatRate(stats.low)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('currency.average')}</div>
          <div className="text-base font-semibold text-gray-900 dark:text-white">{formatRate(stats.average)}</div>
        </div>
      </div>
    </div>
  )
}
