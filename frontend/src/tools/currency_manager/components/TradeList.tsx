/**
 * 交易列表组件
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { deleteTrade, exportTradesCsv, type TradeRecord } from '../api'
import { ConfirmModal } from '@/components'
import { formatMoney } from '../utils/format'
import { formatDateTime } from '@/utils/datetime'
import { TRADES_PAGE_SIZE } from '../utils/constants'

interface Props {
  trades: TradeRecord[]
  loading?: boolean
  onRefresh: () => void
  currencyPair: string
}

export default function TradeList({ trades, loading, onRefresh, currencyPair }: Props) {
  const { t } = useTranslation()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  })

  // 计算分页
  const totalPages = Math.ceil(trades.length / TRADES_PAGE_SIZE)
  const startIndex = (currentPage - 1) * TRADES_PAGE_SIZE
  const endIndex = startIndex + TRADES_PAGE_SIZE
  const currentTrades = trades.slice(startIndex, endIndex)

  const handleDelete = (id: number) => {
    setDeleteConfirm({ open: true, id })
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const { blob, filename } = await exportTradesCsv(currencyPair)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }
  
  const confirmDelete = async () => {
    if (!deleteConfirm.id) return
    
    setDeletingId(deleteConfirm.id)
    try {
      await deleteTrade(deleteConfirm.id)
      // 删除后如果当前页没有数据了，跳到上一页
      const newTotal = trades.length - 1
      const newTotalPages = Math.ceil(newTotal / TRADES_PAGE_SIZE)
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages)
      }
      onRefresh()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeletingId(null)
      setDeleteConfirm({ open: false, id: null })
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 animate-pulse">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-slate-700 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 text-center text-gray-500 dark:text-gray-400">
        {t('currency.noTrades')}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {currentTrades.map((trade) => {
          const isBuy = trade.type === 'buy'
          const isProfit = trade.profit_loss >= 0

          return (
            <div key={trade.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex items-center justify-between">
                {/* 左侧：类型 + 金额 */}
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isBuy ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {isBuy ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${
                        isBuy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {isBuy ? t('currency.buy') : t('currency.sell')}
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {trade.amount.toLocaleString()} {trade.currency_pair.split('_')[0]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      @ {trade.rate.toFixed(4)} · {formatDateTime(trade.timestamp, { format: 'datetime' })}
                    </div>
                  </div>
                </div>

                {/* 右侧：成本/盈亏 + 删除 */}
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {formatMoney(trade.cost_cny)}
                    </div>
                    {isBuy && trade.profit_loss !== 0 && (
                      <div className={`text-xs ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isProfit ? '+' : ''}{formatMoney(trade.profit_loss)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(trade.id)}
                    disabled={deletingId === trade.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 备注 */}
              {trade.note && (
                <div className="mt-2 ml-11 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/50 px-2 py-1 rounded">
                  {trade.note}
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* 底部：分页 + 导出 */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-slate-700">
        {/* 左侧：分页信息 */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {trades.length > TRADES_PAGE_SIZE ? (
            <>{startIndex + 1}-{Math.min(endIndex, trades.length)} / {trades.length}</>
          ) : (
            <>{t('currency.totalRecords', { count: trades.length })}</>
          )}
        </div>
        
        {/* 中间：分页控件 */}
        {totalPages > 1 && (
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="px-2 text-sm text-gray-700 dark:text-gray-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        )}
        
        {/* 右侧：导出按钮 */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t('currency.export.csv')}</span>
        </button>
      </div>
      
      {/* 删除确认弹窗 */}
      <ConfirmModal
        isOpen={deleteConfirm.open}
        type="danger"
        message={t('currency.confirmDelete')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  )
}
