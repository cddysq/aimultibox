/**
 * 预警配置组件
 */
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  Plus,
  X,
  Trash2,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react'
import { getAlerts, createAlert, deleteAlert, updateAlert, type AlertCreate } from '../api'
import { ConfirmModal } from '@/components'
import { getErrorMessage } from '@/types'

interface AlertConfigProps {
  currencyPair: string
  currentRate?: number
}

const CONDITION_OPTIONS = [
  { value: 'rate_above', icon: TrendingUp, color: 'text-green-500' },
  { value: 'rate_below', icon: TrendingDown, color: 'text-red-500' },
  { value: 'daily_change_above', icon: Activity, color: 'text-orange-500' },
] as const

export default function AlertConfig({ currencyPair, currentRate }: AlertConfigProps) {
  const { t } = useTranslation()
  
  const [error, setError] = useState('')
  
  // 添加表单
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCondition, setNewCondition] = useState<AlertCreate['condition']>('rate_above')
  const [newThreshold, setNewThreshold] = useState('')
  const [adding, setAdding] = useState(false)
  
  // 删除确认弹窗
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  })

  const queryClient = useQueryClient()

  // 预警规则查询
  const alertsQuery = useQuery({
    queryKey: ['currency', 'alerts', currencyPair],
    queryFn: () => getAlerts(currencyPair),
    staleTime: 60_000,
  })

  const alerts = alertsQuery.data?.items || []

  useEffect(() => {
    if (alertsQuery.isError) {
      setError(getErrorMessage(alertsQuery.error, t('errors.backendUnavailable')))
    }
  }, [alertsQuery.isError, alertsQuery.error, t])

  // 添加预警
  const handleAdd = async () => {
    const threshold = parseFloat(newThreshold)
    if (isNaN(threshold) || threshold <= 0) {
      setError(t('currency.alerts.invalidThreshold'))
      return
    }

    setAdding(true)
    setError('')
    try {
      await createAlert({
        currency_pair: currencyPair,
        condition: newCondition,
        threshold,
        enabled: true,
      })
      setNewThreshold('')
      setShowAddForm(false)
      await queryClient.invalidateQueries({ queryKey: ['currency', 'alerts', currencyPair] })
    } catch (err) {
      setError(getErrorMessage(err, t('currency.errors.createFailed')))
    } finally {
      setAdding(false)
    }
  }

  // 删除预警
  const handleDelete = (id: number) => {
    setDeleteConfirm({ open: true, id })
  }
  
  const confirmDelete = async () => {
    if (!deleteConfirm.id) return
    
    try {
      await deleteAlert(deleteConfirm.id)
      await queryClient.invalidateQueries({ queryKey: ['currency', 'alerts', currencyPair] })
    } catch (err) {
      setError(getErrorMessage(err, t('errors.processingFailed')))
    } finally {
      setDeleteConfirm({ open: false, id: null })
    }
  }

  // 切换启用状态
  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await updateAlert(id, { enabled: !enabled })
      await queryClient.invalidateQueries({ queryKey: ['currency', 'alerts', currencyPair] })
    } catch (err) {
      setError(getErrorMessage(err, t('errors.processingFailed')))
    }
  }

  // 获取条件显示文本
  const getConditionText = (condition: string, threshold: number) => {
    switch (condition) {
      case 'rate_above':
        return t('currency.alerts.rateAbove', { value: threshold.toFixed(4) })
      case 'rate_below':
        return t('currency.alerts.rateBelow', { value: threshold.toFixed(4) })
      case 'daily_change_above':
        return t('currency.alerts.changeAbove', { value: threshold.toFixed(2) })
      default:
        return condition
    }
  }

  const getConditionIcon = (condition: string) => {
    const option = CONDITION_OPTIONS.find(o => o.value === condition)
    if (!option) return null
    const Icon = option.icon
    return <Icon className={`w-4 h-4 ${option.color}`} />
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
          <Bell className="w-5 h-5 text-primary-500" />
          <span>{t('currency.alerts.title')}</span>
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`p-1.5 rounded-lg transition-colors ${
            showAddForm 
              ? 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700' 
              : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30'
          }`}
        >
          {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* 添加表单 */}
      {showAddForm && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg space-y-3">
          {/* 条件选择 */}
          <div className="flex flex-wrap gap-2">
            {CONDITION_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  onClick={() => setNewCondition(option.value)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    newCondition === option.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t(`currency.alerts.conditions.${option.value}`)}</span>
                </button>
              )
            })}
          </div>

          {/* 阈值输入 */}
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              placeholder={newCondition === 'daily_change_above' 
                ? t('currency.alerts.percentPlaceholder')
                : currentRate?.toFixed(4) || t('currency.alerts.ratePlaceholder')
              }
              step={newCondition === 'daily_change_above' ? '0.1' : '0.0001'}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newThreshold}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.confirm')}
            </button>
          </div>

          {/* 当前汇率提示 + 取消按钮 */}
          <div className="flex items-center justify-between">
            {currentRate && newCondition !== 'daily_change_above' ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('currency.alerts.currentRateHint', { rate: currentRate.toFixed(4) })}
              </p>
            ) : <span />}
            <button
              onClick={() => { setShowAddForm(false); setNewThreshold('') }}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* 规则列表 */}
      {alertsQuery.isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
          {t('currency.alerts.noAlerts')}
        </p>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                alert.enabled
                  ? 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600'
                  : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-3">
                {getConditionIcon(alert.condition)}
                <span className={`text-sm ${alert.enabled ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  {getConditionText(alert.condition, alert.threshold)}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* 启用/禁用开关 */}
                <button
                  onClick={() => handleToggle(alert.id, alert.enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    alert.enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      alert.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                
                {/* 删除按钮 */}
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 说明 */}
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {t('currency.alerts.hint')}
      </p>
      
      {/* 删除确认弹窗 */}
      <ConfirmModal
        isOpen={deleteConfirm.open}
        type="danger"
        message={t('currency.alerts.confirmDelete')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  )
}
