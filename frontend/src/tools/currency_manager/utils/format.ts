/**
 * 汇率管家 - 格式化工具
 */

/** 格式化汇率 */
export function formatRate(rate: number): string {
  if (rate < 0.1) return rate.toFixed(6)
  if (rate < 1) return rate.toFixed(5)
  return rate.toFixed(4)
}

/** 格式化金额 */
export function formatMoney(amount: number, currency = 'CNY'): string {
  const symbol = currency === 'CNY' ? '¥' : ''
  return `${symbol}${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** 格式化涨跌幅 */
export function formatChange(change: number): string {
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
}

/** 格式化数字 */
export function formatNumber(num: number, currency?: string): string {
  if (isNaN(num)) return ''
  if (num === 0) return '0'
  if (currency === 'JPY') return Math.round(num).toString()
  const decimals = num < 1 ? 6 : 2
  return num.toFixed(decimals).replace(/\.?0+$/, '')
}
