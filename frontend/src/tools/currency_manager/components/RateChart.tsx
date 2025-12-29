/**
 * 汇率图表组件
 */
import { useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ReactECharts from 'echarts-for-react'
import type { ECharts } from 'echarts'
import type { RateHistory, TradeRecord } from '../api'
import { formatDate } from '../utils/format'

/** zrender 事件参数 */
interface ZrClickEvent {
  offsetX: number
  offsetY: number
}

/** tooltip formatter 参数 */
interface TooltipParam {
  name: string
  value: number
}

interface Props {
  history: RateHistory[]
  trades?: TradeRecord[]
  loading?: boolean
  onPointClick?: (rate: number, timestamp: string) => void
  darkMode?: boolean
}

export default function RateChart({ history, trades = [], loading, onPointClick, darkMode = false }: Props) {
  const { t } = useTranslation()
  const chartRef = useRef<ReactECharts>(null)

  // 图表实例就绪后绑定 zrender 点击事件
  const onChartReady = useCallback((instance: ECharts) => {
    if (!onPointClick) return

    const zr = instance.getZr()
    zr.on('click', (params: ZrClickEvent) => {
      // 获取点击位置对应的数据索引
      const pointInPixel = [params.offsetX, params.offsetY]
      if (instance.containPixel('grid', pointInPixel)) {
      const pointInGrid = instance.convertFromPixel({ seriesIndex: 0 }, pointInPixel)
        const idx = Math.round(pointInGrid[0] ?? 0)
        const item = history[idx]
        if (idx >= 0 && idx < history.length && item) {
          onPointClick(item.rate, item.timestamp)
        }
      }
    })
  }, [history, onPointClick])

  // 构建图表数据
  const chartData = useMemo(() => {
    if (!history.length) return { times: [], rates: [], buyMarks: [], sellMarks: [] }

    const times = history.map(h => formatDate(h.timestamp))
    const rates = history.map(h => h.rate)

    // 交易标记点
    const buyMarks: Array<{ coord: [number, number]; value: string; itemStyle: { color: string } }> = []
    const sellMarks: Array<{ coord: [number, number]; value: string; itemStyle: { color: string } }> = []

    trades.forEach(trade => {
      const tradeTime = new Date(trade.timestamp).getTime()
      // 找到最接近的历史数据点
      let closestIdx = 0
      let minDiff = Infinity
      history.forEach((h, idx) => {
        const histTime = new Date(h.timestamp).getTime()
        const diff = Math.abs(histTime - tradeTime)
        if (diff < minDiff) {
          minDiff = diff
          closestIdx = idx
        }
      })

      const mark = {
        coord: [closestIdx, trade.rate] as [number, number],
        value: trade.amount.toLocaleString(),
        itemStyle: {
          color: trade.type === 'buy' ? '#22c55e' : '#ef4444',
        },
      }

      if (trade.type === 'buy') {
        buyMarks.push(mark)
      } else {
        sellMarks.push(mark)
      }
    })

    return { times, rates, buyMarks, sellMarks }
  }, [history, trades])

  // 图表配置
  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: darkMode ? '#1e293b' : '#fff',
      borderColor: darkMode ? '#334155' : '#e5e7eb',
      textStyle: {
        color: darkMode ? '#e5e7eb' : '#1f2937',
      },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || !params.length) return ''
        const point = params[0] as TooltipParam
        // 保留 6 位小数精度
        return `
          <div style="font-size: 12px;">
            <div style="margin-bottom: 4px; color: ${darkMode ? '#94a3b8' : '#6b7280'};">${point.name}</div>
            <div style="font-weight: 600;">${t('currency.rate')}: ${point.value.toFixed(6)}</div>
          </div>
        `
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: chartData.times,
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: darkMode ? '#334155' : '#e5e7eb',
        },
      },
      axisLabel: {
        color: darkMode ? '#94a3b8' : '#6b7280',
        fontSize: 11,
        rotate: 45,
        // 智能显示标签：最多显示 8-10 个标签，避免过密
        interval: Math.max(0, Math.floor(chartData.times.length / 10) - 1),
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: darkMode ? '#94a3b8' : '#6b7280',
        // 保留 6 位小数精度
        formatter: (value: number) => value.toFixed(6),
      },
      splitLine: {
        lineStyle: {
          color: darkMode ? '#1e293b' : '#f3f4f6',
        },
      },
    },
    series: [
      {
        name: t('currency.rate'),
        type: 'line',
        data: chartData.rates,
        smooth: true,
        // 数据点多时隐藏圆点，只显示线条，避免过密
        symbol: chartData.rates.length > 50 ? 'none' : 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 2,
          color: '#6366f1',
        },
        itemStyle: {
          color: '#6366f1',
          borderWidth: 2,
          borderColor: '#fff',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.3)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.05)' },
            ],
          },
        },
        markPoint: {
          symbol: 'triangle',
          symbolSize: 12,
          data: [
            ...chartData.buyMarks.map((m) => ({
              ...m,
              symbolRotate: 0,
            })),
            ...chartData.sellMarks.map((m) => ({
              ...m,
              symbolRotate: 180,
            })),
          ],
          label: {
            show: false,
          },
        },
      },
    ],
  }), [chartData, darkMode, t])

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 h-64 sm:h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">{t('common.loading')}</div>
      </div>
    )
  }

  if (!history.length) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 h-64 sm:h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
        {t('currency.noData')}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3 sm:p-4">
      <ReactECharts
        ref={chartRef}
        option={option}
        className="h-60 sm:h-80"
        onChartReady={onChartReady}
        opts={{ renderer: 'svg' }}
      />
      {onPointClick && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
          {t('currency.clickToAddTrade')}
        </p>
      )}
    </div>
  )
}
