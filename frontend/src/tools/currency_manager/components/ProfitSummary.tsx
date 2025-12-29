/**
 * 盈亏汇总卡片
 */
import { useTranslation } from 'react-i18next'
import { DollarSign, TrendingUp, TrendingDown, Percent } from 'lucide-react'
import type { ProfitSummary as ProfitSummaryType } from '../api'
import { formatMoney, formatChange } from '../utils/format'

interface Props {
  summary: ProfitSummaryType | null
  loading?: boolean
}

export default function ProfitSummary({ summary, loading }: Props) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-slate-700 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!summary || summary.total_cost === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          {t('currency.profitSummary')}
        </h3>
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">
          {t('currency.noProfitData')}
        </p>
      </div>
    )
  }

  const isProfit = summary.profit_loss >= 0
  const profitColor = isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  const profitBg = isProfit ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'

  const metrics = [
    {
      label: t('currency.totalCost'),
      value: formatMoney(summary.total_cost),
      icon: DollarSign,
      color: 'text-gray-600 dark:text-gray-400',
    },
    {
      label: t('currency.currentValue'),
      value: formatMoney(summary.current_value),
      icon: DollarSign,
      color: 'text-gray-600 dark:text-gray-400',
    },
    {
      label: t('currency.profitLoss'),
      value: `${isProfit ? '+' : ''}${formatMoney(summary.profit_loss)}`,
      icon: isProfit ? TrendingUp : TrendingDown,
      color: profitColor,
      highlight: true,
    },
    {
      label: t('currency.returnRate'),
      value: formatChange(summary.return_rate),
      icon: Percent,
      color: profitColor,
    },
  ]

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
        {t('currency.profitSummary')}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg ${metric.highlight ? profitBg : 'bg-gray-50 dark:bg-slate-700/50'}`}
          >
            <div className="flex items-center space-x-2 mb-1">
              <metric.icon className={`w-4 h-4 ${metric.color}`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{metric.label}</span>
            </div>
            <div className={`text-lg font-semibold ${metric.color}`}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* 持仓信息 */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('currency.holdingAmount')}: </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {summary.holding_amount.toLocaleString()} {summary.currency_pair.split('_')[0]}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('currency.avgCostRate')}: </span>
          <span className="font-medium text-gray-900 dark:text-white">{summary.avg_cost_rate.toFixed(4)}</span>
        </div>
      </div>
    </div>
  )
}
