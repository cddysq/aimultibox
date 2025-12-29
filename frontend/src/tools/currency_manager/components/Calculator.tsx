/**
 * 汇率计算器组件
 */
import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator as CalcIcon, ArrowDownUp, ChevronDown } from 'lucide-react'
import type { RateData, CurrencyInfo } from '../api'
import { formatNumber } from '../utils/format'
import CurrencySelect, { type CurrencyOption, FlagIcon } from './CurrencySelect'

interface Props {
  rates: RateData[]
  currencies: CurrencyInfo[]
  defaultExpanded?: boolean
}

export default function Calculator({ rates, currencies, defaultExpanded = false }: Props) {
  const { t } = useTranslation()

  const [expanded, setExpanded] = useState(defaultExpanded)
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [fromCurrency, setFromCurrency] = useState('CNY')
  const [toCurrency, setToCurrency] = useState('JPY')

  const currencyOptions: CurrencyOption[] = useMemo(() => {
    const options: CurrencyOption[] = [{ code: 'CNY', name: '人民币' }]
    currencies.forEach(c => {
      const code = c.pair?.split('_')[0] ?? 'UNKNOWN'
      options.push({ code, name: c.name })
    })
    return options
  }, [currencies])

  const getRateToCNY = useCallback((code: string): number | null => {
    if (code === 'CNY') return 1
    const rateData = rates.find(r => r.currency_pair === `${code}_CNY`)
    return rateData?.rate ?? null
  }, [rates])

  const exchangeRate = useMemo(() => {
    const fromRate = getRateToCNY(fromCurrency)
    const toRate = getRateToCNY(toCurrency)

    if (fromRate === null || toRate === null) return null
    if (fromCurrency === toCurrency) return 1

    return fromRate / toRate
  }, [fromCurrency, toCurrency, getRateToCNY])

  const handleFromChange = (value: string) => {
    setFromAmount(value)
    if (exchangeRate === null) return
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      setToAmount(formatNumber(num * exchangeRate, toCurrency))
    } else {
      setToAmount('')
    }
  }

  const handleToChange = (value: string) => {
    setToAmount(value)
    if (exchangeRate === null || exchangeRate === 0) return
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      setFromAmount(formatNumber(num / exchangeRate, fromCurrency))
    } else {
      setFromAmount('')
    }
  }

  const swapCurrencies = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  const handleFromCurrencyChange = (code: string) => {
    setFromCurrency(code)
    const fromRate = getRateToCNY(code)
    const toRate = getRateToCNY(toCurrency)
    if (fromRate && toRate) {
      const rate = fromRate / toRate
      const num = parseFloat(fromAmount)
      if (!isNaN(num) && num >= 0) {
        setToAmount(formatNumber(num * rate, toCurrency))
      }
    }
  }

  const handleToCurrencyChange = (code: string) => {
    setToCurrency(code)
    const fromRate = getRateToCNY(fromCurrency)
    const toRate = getRateToCNY(code)
    if (fromRate && toRate) {
      const rate = fromRate / toRate
      const num = parseFloat(fromAmount)
      if (!isNaN(num) && num >= 0) {
        setToAmount(formatNumber(num * rate, code))
      }
    }
  }


  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      {/* 标题栏（可点击展开/收起） */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-xl"
      >
        <div className="flex items-center space-x-2">
          <CalcIcon className="w-4 h-4 text-primary-500" />
          <span className="font-medium text-gray-900 dark:text-white text-sm">
            {t('currency.calculator.title')}
          </span>
          {!expanded && exchangeRate !== null && fromCurrency !== toCurrency && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              1 {fromCurrency} ≈ {exchangeRate < 1 ? exchangeRate.toFixed(4) : exchangeRate.toFixed(2)} {toCurrency}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          {/* 当前汇率 */}
          {exchangeRate !== null && fromCurrency !== toCurrency && (
            <div className="mb-3 px-3 py-2 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                <FlagIcon code={fromCurrency} size="sm" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">1 {fromCurrency}</span>
                <span className="text-gray-400">≈</span>
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                  {exchangeRate < 1 ? exchangeRate.toFixed(6) : exchangeRate.toFixed(4)}
                </span>
                <FlagIcon code={toCurrency} size="sm" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{toCurrency}</span>
              </div>
            </div>
          )}

          {/* 源货币输入 */}
          <div className="mb-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              {t('currency.calculator.from')}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => handleFromChange(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-lg font-medium focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <CurrencySelect
                value={fromCurrency}
                options={currencyOptions}
                onChange={handleFromCurrencyChange}
              />
            </div>
          </div>

          {/* 交换按钮 */}
          <div className="flex justify-center my-1">
            <button
              onClick={swapCurrencies}
              className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full transition-all hover:scale-110 active:scale-95"
              title={t('currency.calculator.swap')}
            >
              <ArrowDownUp className="w-4 h-4 text-primary-500" />
            </button>
          </div>

          {/* 目标货币输入 */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              {t('currency.calculator.to')}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={toAmount}
                onChange={(e) => handleToChange(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-lg font-medium focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <CurrencySelect
                value={toCurrency}
                options={currencyOptions}
                onChange={handleToCurrencyChange}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 text-center">
            {t('currency.calculator.midRateHint')}
          </div>
        </div>
      )}
    </div>
  )
}
