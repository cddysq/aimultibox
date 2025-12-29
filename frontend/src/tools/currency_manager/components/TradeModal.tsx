/**
 * 交易录入弹窗
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import { createTrade, type TradeCreate } from '../api'
import { getErrorMessage } from '@/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currencyPair: string
  prefillRate?: number
  prefillTimestamp?: string
}

export default function TradeModal({ isOpen, onClose, onSuccess, currencyPair, prefillRate, prefillTimestamp }: Props) {
  const { t } = useTranslation()
  const [type, setType] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 弹窗打开时，用 prefillRate 初始化汇率
  useEffect(() => {
    if (isOpen && prefillRate !== undefined) {
      setRate(prefillRate.toString())
    }
  }, [isOpen, prefillRate])

  // 重置表单
  const resetForm = () => {
    setType('buy')
    setAmount('')
    setRate('')
    setNote('')
    setError('')
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!amount || !rate) {
      setError(t('currency.errors.requiredFields'))
      return
    }

    const amountNum = parseFloat(amount)
    const rateNum = parseFloat(rate)

    if (isNaN(amountNum) || amountNum <= 0) {
      setError(t('currency.errors.invalidAmount'))
      return
    }

    if (isNaN(rateNum) || rateNum <= 0) {
      setError(t('currency.errors.invalidRate'))
      return
    }

    setLoading(true)

    try {
      const data: TradeCreate = {
        type,
        currency_pair: currencyPair,
        amount: amountNum,
        rate: rateNum,
        note: note || undefined,
      }

      if (prefillTimestamp) {
        data.timestamp = prefillTimestamp
      }

      await createTrade(data)
      resetForm()
      onSuccess()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, t('currency.errors.createFailed')))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const currency = currencyPair.split('_')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* 弹窗内容 */}
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('currency.addTrade')}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 买入/卖出切换 */}
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setType('buy')}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                type === 'buy'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('currency.buy')}
            </button>
            <button
              type="button"
              onClick={() => setType('sell')}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                type === 'sell'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t('currency.sell')}
            </button>
          </div>

          {/* 金额输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('currency.amount')} ({currency})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              step="any"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* 汇率输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('currency.rate')}
            </label>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.0000"
              step="any"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('currency.note')} ({t('common.optional')})
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* 预览 */}
          {amount && rate && (
            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('currency.costPreview')}: </span>
              <span className="font-medium text-gray-900 dark:text-white">
                ¥{(parseFloat(amount) * parseFloat(rate)).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* 按钮 */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
