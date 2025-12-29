/**
 * 汇率管家 - 常量定义
 */

/** 时间范围选项 (天) */
export const TIME_RANGES = [7, 30, 90] as const
export type TimeRange = (typeof TIME_RANGES)[number]

/** 默认货币对 */
export const DEFAULT_CURRENCY_PAIR = 'JPY_CNY'

/** 默认刷新间隔 (秒) */
export const DEFAULT_REFRESH_INTERVAL = 300

/** 刷新间隔选项 (秒) */
export const REFRESH_INTERVALS = [
  { value: 60, labelKey: '1min' },
  { value: 180, labelKey: '3min' },
  { value: 300, labelKey: '5min' },
  { value: 600, labelKey: '10min' },
  { value: 900, labelKey: '15min' },
  { value: 1800, labelKey: '30min' },
] as const

/** 本地存储键名 */
export const STORAGE_KEYS = {
  REFRESH_INTERVAL: 'currency_refresh_interval',
} as const

/** 每页交易记录数 */
export const TRADES_PAGE_SIZE = 10
