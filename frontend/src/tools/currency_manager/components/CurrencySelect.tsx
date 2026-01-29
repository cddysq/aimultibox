/**
 * 货币选择器组件
 */
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/** 货币代码到国家代码映射 */
const COUNTRY_CODE_MAP: Record<string, string> = {
  CNY: 'cn',
  JPY: 'jp',
  USD: 'us',
  EUR: 'eu',
  GBP: 'gb',
  AUD: 'au',
  HKD: 'hk',
  SGD: 'sg',
  CAD: 'ca',
  CHF: 'ch',
  THB: 'th',
  NZD: 'nz',
  KRW: 'kr',
  MYR: 'my',
  PHP: 'ph',
}

/** 获取国旗 SVG 路径 */
const getFlagUrl = (currencyCode: string): string => {
  const countryCode = COUNTRY_CODE_MAP[currencyCode] || 'cn'
  return `/flags/${countryCode}.svg`
}

/** 国旗图标 */
export function FlagIcon({ code, size = 'md' }: { code: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-4' : size === 'md' ? 'w-6 h-5' : 'w-8 h-6'
  return (
    <img
      src={getFlagUrl(code)}
      alt={code}
      className={`${sizeClass} object-cover rounded-sm`}
    />
  )
}

export interface CurrencyOption {
  code: string
  name: string
  pair?: string
}

interface CurrencySelectProps {
  value: string
  options: CurrencyOption[]
  onChange: (value: string) => void
  /** 显示模式：code 显示货币代码，pair 显示货币对 */
  displayMode?: 'code' | 'pair'
  /** 尺寸 */
  size?: 'sm' | 'md'
}

export default function CurrencySelect({ 
  value, 
  options, 
  onChange, 
  displayMode = 'code',
  size = 'md' 
}: CurrencySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const selected = options.find(o => 
    displayMode === 'pair' ? o.pair === value : o.code === value
  )
  const displayCode = displayMode === 'pair' 
    ? value.split('_')[0] || 'CNY'
    : value

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const buttonClass = size === 'sm'
    ? 'px-2.5 py-1.5 min-w-[140px]'
    : 'px-3 py-2.5 min-w-[110px]'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors ${buttonClass}`}
      >
        <FlagIcon code={displayCode} size={size === 'sm' ? 'sm' : 'md'} />
        <span className={`font-medium text-gray-900 dark:text-white flex-1 text-left ${size === 'sm' ? 'text-sm' : ''}`}>
          {displayMode === 'pair' ? selected?.name || value : value}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 shadow-xl z-50 py-1 max-h-72 overflow-y-auto">
          {options.map((option) => {
            const optionCode = option.pair?.split('_')[0] || option.code
            const isSelected = displayMode === 'pair' 
              ? option.pair === value 
              : option.code === value
            
            return (
              <button
                key={option.pair || option.code}
                type="button"
                onClick={() => {
                  onChange(displayMode === 'pair' ? (option.pair || option.code) : option.code)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                  isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}
              >
                <FlagIcon code={optionCode} size="md" />
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {option.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {option.pair ? option.pair.replace('_', '/') : option.code}
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
