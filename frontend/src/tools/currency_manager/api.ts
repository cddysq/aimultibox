/**
 * 汇率管家 - API 封装
 */
import api from '@/api'

const BASE_URL = '/tools/currency-manager'

// ========== 类型定义 ==========

export interface RateData {
  currency_pair: string
  rate: number              // 中间价
  rtb_bid: number           // 现汇买入价（银行买入你的现汇）
  rth_bid: number           // 现钞买入价（银行买入你的现钞）
  rtc_ofr: number           // 现汇卖出价（银行卖给你现汇）
  rth_ofr: number           // 现钞卖出价（银行卖给你现钞）
  timestamp: string         // ISO 时间戳
  time_str?: string         // 原始时间字符串（如 "2025年12月19日 14:18:42"）
}

export interface RateHistory {
  id: number
  currency_pair: string
  rate: number              // 中间价
  rtb_bid: number           // 现汇买入价
  rth_bid: number           // 现钞买入价
  rtc_ofr: number           // 现汇卖出价
  rth_ofr: number           // 现钞卖出价
  timestamp: string
  time_str?: string         // 原始时间字符串
}

export interface RateStats {
  currency_pair: string
  current: number
  high: number
  low: number
  average: number
  change: number
  updated_at: string
  streak_days: number    // 连涨/连跌天数（正=涨，负=跌）
  streak_change: number  // 连续期间累计涨跌幅(%)
}

export interface TradeRecord {
  id: number
  type: 'buy' | 'sell'
  currency_pair: string
  amount: number
  rate: number
  timestamp: string
  note?: string
  cost_cny: number
  current_value: number
  profit_loss: number
}

export interface TradeCreate {
  type: 'buy' | 'sell'
  currency_pair?: string
  amount: number
  rate: number
  timestamp?: string
  note?: string
}

export interface ProfitSummary {
  currency_pair: string
  total_cost: number
  current_value: number
  profit_loss: number
  return_rate: number
  holding_amount: number
  avg_cost_rate: number
  current_rate: number
}

export interface AlertRule {
  id: number
  currency_pair: string
  condition: 'rate_above' | 'rate_below' | 'daily_change_above'
  threshold: number
  notify_email?: string
  enabled: boolean
  created_at: string
  last_triggered?: string
}

export interface AlertCreate {
  currency_pair?: string
  condition: 'rate_above' | 'rate_below' | 'daily_change_above'
  threshold: number
  notify_email?: string
  enabled?: boolean
}

export interface CurrencyInfo {
  pair: string
  name: string
}

export interface RefreshConfig {
  /** 默认刷新间隔（秒） */
  default_interval: number
  /** 最小刷新间隔（秒） */
  min_interval: number
  /** 最大刷新间隔（秒） */
  max_interval: number
  /** 缓存有效期（秒） */
  cache_ttl: number
}

export interface ToolInfo {
  id: string
  name: string
  description: string
  icon: string
  version: string
  supported_currencies: CurrencyInfo[]
  refresh_config: RefreshConfig
}

// ========== API 方法 ==========

/** 获取工具信息 */
export async function getToolInfo(): Promise<ToolInfo> {
  const response = await api.get(`${BASE_URL}/`)
  return response.data
}

/** 触发的预警 */
export interface TriggeredAlert {
  alert_id: number
  condition: string
  threshold: number
  current_rate: number
  currency_pair: string
}

/** 汇率响应 */
export interface RatesResponse {
  data: RateData[]
  source: string
  /** 数据更新时间 */
  update_time?: string
  /** 触发的预警 */
  triggered_alerts?: TriggeredAlert[]
}

/** 获取当前汇率列表 */
export async function getRates(force = false): Promise<RatesResponse> {
  const response = await api.get(`${BASE_URL}/rates`, { params: { force } })
  return response.data
}

/** 手动刷新汇率 */
export async function refreshRates(): Promise<RatesResponse> {
  const response = await api.post(`${BASE_URL}/rates/refresh`)
  return response.data
}

/** 获取单个货币对汇率 */
export async function getRate(currencyPair: string): Promise<{ data: RateData }> {
  const response = await api.get(`${BASE_URL}/rates/${currencyPair}`)
  return response.data
}

/** 获取汇率历史 */
export async function getRateHistory(currencyPair: string, days = 7): Promise<{ data: RateHistory[], total: number }> {
  const response = await api.get(`${BASE_URL}/rates/${currencyPair}/history`, { params: { days } })
  return response.data
}

/** 获取汇率统计 */
export async function getRateStats(currencyPair: string, days = 7): Promise<{ data: RateStats }> {
  const response = await api.get(`${BASE_URL}/rates/${currencyPair}/stats`, { params: { days } })
  return response.data
}

/** 创建交易记录 */
export async function createTrade(data: TradeCreate): Promise<{ data: TradeRecord }> {
  const response = await api.post(`${BASE_URL}/trades`, data)
  return response.data
}

/** 获取交易列表 */
export async function getTrades(currencyPair: string, type?: 'buy' | 'sell', limit = 100, offset = 0): Promise<{ data: TradeRecord[], total: number }> {
  const response = await api.get(`${BASE_URL}/trades`, { params: { currency_pair: currencyPair, type, limit, offset } })
  return response.data
}

/** 删除交易记录 */
export async function deleteTrade(tradeId: number): Promise<void> {
  await api.delete(`${BASE_URL}/trades/${tradeId}`)
}

/** 获取盈亏汇总 */
export async function getProfit(currencyPair: string): Promise<{ summary: ProfitSummary, trades: TradeRecord[] }> {
  const response = await api.get(`${BASE_URL}/profit/${currencyPair}`)
  return response.data
}

/** 创建预警规则 */
export async function createAlert(data: AlertCreate): Promise<{ data: AlertRule }> {
  const response = await api.post(`${BASE_URL}/alerts`, data)
  return response.data
}

/** 获取预警规则列表 */
export async function getAlerts(currencyPair?: string): Promise<{ data: AlertRule[], total: number }> {
  const response = await api.get(`${BASE_URL}/alerts`, { params: { currency_pair: currencyPair } })
  return response.data
}

/** 更新预警规则 */
export async function updateAlert(alertId: number, data: Partial<AlertCreate>): Promise<void> {
  await api.put(`${BASE_URL}/alerts/${alertId}`, data)
}

/** 删除预警规则 */
export async function deleteAlert(alertId: number): Promise<void> {
  await api.delete(`${BASE_URL}/alerts/${alertId}`)
}
