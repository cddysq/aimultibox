/**
 * 汇率管家 - 格式化工具函数
 */

/**
 * 格式化汇率
 * 根据实际数值智能决定小数位数（参考招行返回的精度）
 * @param rate 汇率
 */
export function formatRate(rate: number): string {
  // 小于 0.1 的汇率（如 JPY）显示 5-6 位小数
  if (rate < 0.1) return rate.toFixed(6)
  // 小于 1 的汇率显示 5 位小数
  if (rate < 1) return rate.toFixed(5)
  // 其他汇率显示 4 位小数
  return rate.toFixed(4)
}

/**
 * 格式化金额
 * @param amount 金额
 * @param currency 货币代码
 */
export function formatMoney(amount: number, currency = 'CNY'): string {
  const symbol = currency === 'CNY' ? '¥' : ''
  return `${symbol}${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * 格式化日期时间
 * @param timestamp ISO 时间戳
 * @param format 格式类型
 */
export function formatDate(
  timestamp: string,
  format: 'short' | 'long' | 'chart' = 'short'
): string {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  switch (format) {
    case 'long':
      return `${date.getFullYear()}/${month}/${day} ${hour}:${minute}`
    case 'chart':
      return `${month}/${day} ${hour}:${minute}`
    case 'short':
    default:
      return `${month}/${day} ${hour}:${minute}`
  }
}

/**
 * 格式化倒计时
 * @param seconds 秒数
 */
export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`
}

/**
 * 格式化涨跌幅
 * @param change 涨跌百分比
 */
export function formatChange(change: number): string {
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
}

/**
 * 格式化数字（智能小数位）
 * @param num 数字
 * @param currency 货币代码（影响小数位）
 */
export function formatNumber(num: number, currency?: string): string {
  if (isNaN(num)) return ''
  if (num === 0) return '0'

  // 日元不需要小数位
  if (currency === 'JPY') return Math.round(num).toString()

  // 根据数值大小决定小数位
  const decimals = num < 1 ? 6 : 2
  return num.toFixed(decimals).replace(/\.?0+$/, '')
}
