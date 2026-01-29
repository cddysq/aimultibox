/**
 * 全局时间处理 - UTC 存储，本地展示
 */
import { usePrefsStore } from '@/stores'

export type DateTimeFormat = 'date' | 'time' | 'datetime' | 'short' | 'relative'

interface FormatOptions {
  format?: DateTimeFormat
  timezone?: string
  locale?: string
}

/** 格式化 UTC 时间为用户本地时间 */
export function formatDateTime(
  utcTimestamp: string | Date | null | undefined,
  options: FormatOptions = {}
): string {
  if (!utcTimestamp) return ''

  const { timezone, locale, format = 'datetime' } = options
  const store = usePrefsStore.getState()
  const tz = timezone || store.timezone
  const loc = locale || store.locale

  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp
  if (isNaN(date.getTime())) return ''

  if (format === 'relative') {
    return formatRelativeTime(date, loc)
  }

  const opts: Intl.DateTimeFormatOptions = { timeZone: tz }

  switch (format) {
    case 'date':
      Object.assign(opts, { year: 'numeric', month: '2-digit', day: '2-digit' })
      break
    case 'time':
      Object.assign(opts, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      break
    case 'short':
      Object.assign(opts, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      break
    default:
      Object.assign(opts, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return new Intl.DateTimeFormat(loc, opts).format(date)
}

/** 格式化为相对时间（如 "3分钟前"） */
function formatRelativeTime(date: Date, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffMs = date.getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second')
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour')
  return rtf.format(diffDay, 'day')
}

/** 本地时间 → UTC ISO 字符串 */
export function toUTCISO(localDateTime: string | Date | null | undefined): string {
  if (!localDateTime) return ''
  const date = typeof localDateTime === 'string' ? new Date(localDateTime) : localDateTime
  return isNaN(date.getTime()) ? '' : date.toISOString()
}
