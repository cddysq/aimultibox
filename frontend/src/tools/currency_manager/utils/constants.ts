/**
 * 汇率管家 - 常量定义
 */

/** 时间范围选项 (天) */
export const TIME_RANGES = [7, 30, 90] as const
export type TimeRange = (typeof TIME_RANGES)[number]

/** 默认货币对 */
export const DEFAULT_CURRENCY_PAIR = 'JPY_CNY'

/** 本地存储键名 */
export const STORAGE_KEYS = {
  TIME_RANGE: 'currency_time_range',
  NOTIFICATION_ENABLED: 'currency_notification_enabled',
} as const

/** 每页交易记录数 */
export const TRADES_PAGE_SIZE = 10
